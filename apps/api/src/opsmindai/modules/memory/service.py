"""3-tier memory store (Core / Episodic+Conversation / Skill) over SQLite FTS5.

Backbone is FTS5 BM25 with a recency+importance composite (Generative Agents
recipe), namespaced by customer_id. The backend is pluggable — this is the
default in-process backend; a QMD backend can implement the same recall()
contract later. See docs/superpowers/specs/2026-06-01-agentic-memory-chat-design.md
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone

from opsmindai.modules.skills.repository import find_relevant_skills
from opsmindai.shared.db import get_connection, init_db
from opsmindai.shared.logging import logger

# Token budget (chars ~= tokens*4). Priority on overflow: core > recent > recall > skills.
CHARS_PER_TOKEN = 4
CORE_TOKEN_CAP = 800
WORKING_SET_TOKEN_CAP = 2200

_CONVERSATION = "conversation"
_WORD = re.compile(r"[a-z0-9]+")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(customer_id: str) -> str:
    """Single source of truth for the namespace key — store and recall both call
    this, so a mismatch (the classic 'saved but invisible' bug) cannot happen."""
    return (customer_id or "default").strip()


def _match_query(text: str) -> str:
    """Build a safe FTS5 MATCH expression: quote each token, OR them together.
    Avoids FTS5 syntax errors on punctuation in free-text queries."""
    terms = {w for w in _WORD.findall((text or "").lower()) if len(w) > 2}
    return " OR ".join(f'"{t}"' for t in terms)


class MemoryService:
    """Default SQLite-FTS5 memory backend."""

    # ---- writes -------------------------------------------------------------
    def store(
        self,
        customer_id: str,
        category: str,
        content: str,
        *,
        importance: int = 5,
        thread_id: str | None = None,
    ) -> bool:
        content = (content or "").strip()
        if not content:
            return False
        cid = _key(customer_id)
        try:
            init_db()
            with get_connection() as conn:
                # Dedup hygiene: skip an exact duplicate in the same category.
                dup = conn.execute(
                    "SELECT 1 FROM memory_fts WHERE customer_id = ? AND category = ? AND content = ? LIMIT 1",
                    (cid, category, content),
                ).fetchone()
                if dup is not None:
                    return False
                conn.execute(
                    "INSERT INTO memory_fts(content, customer_id, category, thread_id, importance, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (content, cid, category, thread_id or "", int(importance), _now()),
                )
                conn.commit()
            return True
        except Exception as exc:  # never let memory writes break a turn
            logger.warning("memory.store.failed", extra={"event": "memory.store.failed", "error": str(exc)})
            return False

    # ---- reads --------------------------------------------------------------
    def recall(self, customer_id: str, query: str, *, k: int = 6, categories: list[str] | None = None) -> list[dict]:
        cid = _key(customer_id)
        match = _match_query(query)
        if not match:
            return []
        cats = categories or ["episode", _CONVERSATION]
        placeholders = ",".join("?" for _ in cats)
        try:
            init_db()
            with get_connection() as conn:
                rows = conn.execute(
                    f"""
                    SELECT content, importance, created_at, bm25(memory_fts) AS rank
                    FROM memory_fts
                    WHERE memory_fts MATCH ? AND customer_id = ? AND category IN ({placeholders})
                    ORDER BY rank LIMIT 30
                    """,
                    (match, cid, *cats),
                ).fetchall()
        except Exception as exc:
            logger.warning("memory.recall.failed", extra={"event": "memory.recall.failed", "error": str(exc)})
            return []

        if not rows:
            return []
        # Composite re-rank: relevance(BM25) + recency(exp decay) + importance.
        ranks = [r["rank"] for r in rows]
        lo, hi = min(ranks), max(ranks)
        now = datetime.now(timezone.utc)
        scored = []
        for r in rows:
            rel = 1.0 if hi == lo else (hi - r["rank"]) / (hi - lo)  # lower bm25 = better
            try:
                age_days = max(0.0, (now - datetime.fromisoformat(r["created_at"])).total_seconds() / 86400)
            except (ValueError, TypeError):
                age_days = 0.0
            recency = math.pow(0.97, age_days)
            importance = min(1.0, (r["importance"] or 5) / 10.0)
            scored.append((rel + recency + importance, r["content"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"content": c} for _, c in scored[:k]]

    def recent_turns(self, customer_id: str, thread_id: str, n: int = 6) -> list[dict]:
        cid = _key(customer_id)
        try:
            init_db()
            with get_connection() as conn:
                rows = conn.execute(
                    "SELECT content, created_at FROM memory_fts "
                    "WHERE customer_id = ? AND category = ? AND thread_id = ? "
                    "ORDER BY created_at DESC LIMIT ?",
                    (cid, _CONVERSATION, thread_id, n),
                ).fetchall()
            return [{"content": r["content"]} for r in reversed(rows)]
        except Exception:
            return []

    def core(self, customer_id: str) -> list[str]:
        cid = _key(customer_id)
        try:
            init_db()
            with get_connection() as conn:
                rows = conn.execute(
                    "SELECT content FROM memory_fts WHERE customer_id = ? AND category = 'core' ORDER BY created_at",
                    (cid,),
                ).fetchall()
            return [r["content"] for r in rows]
        except Exception:
            return []

    # ---- the ONE working-set path ------------------------------------------
    def build_working_set(self, customer_id: str, thread_id: str, query: str) -> dict:
        """Single, deterministic, token-budgeted assembly used by every turn.

        Priority on overflow: core > recent conversation > recalled > skills.
        Core is always present (guaranteed); episodic recall is best-effort.
        Returns both the rendered prompt block and a `used` manifest for
        observability (so 'is memory loading?' is never a guess).
        """
        budget = WORKING_SET_TOKEN_CAP * CHARS_PER_TOKEN
        used: dict[str, list[str]] = {"core": [], "recent": [], "recalled": [], "skills": []}
        sections: list[str] = []

        def take(items: list[str], cap_chars: int) -> list[str]:
            nonlocal budget
            out = []
            for it in items:
                if budget <= 0:
                    break
                snippet = it[:cap_chars]
                if len(snippet) > budget:
                    snippet = snippet[:budget]
                out.append(snippet)
                budget -= len(snippet)
            return out

        core = take(self.core(customer_id), CORE_TOKEN_CAP * CHARS_PER_TOKEN)
        used["core"] = core
        if core:
            sections.append("## What I know about this system (core memory)\n" + "\n".join(f"- {c}" for c in core))

        recent = take([t["content"] for t in self.recent_turns(customer_id, thread_id, 6)], 600)
        used["recent"] = recent
        if recent:
            sections.append("## Recent conversation\n" + "\n".join(recent))

        seen = set(core) | set(recent)
        recall_candidates = [m["content"] for m in self.recall(customer_id, query, k=8) if m["content"] not in seen]
        recalled = take(recall_candidates, 600)
        used["recalled"] = recalled
        if recalled:
            sections.append("## Relevant past events (recalled)\n" + "\n".join(f"- {m}" for m in recalled))

        skills = find_relevant_skills(customer_id, query)
        skill_lines = take([f"{s['failure_pattern']} -> {s['resolution']} (seen {s['success_count']}x)" for s in skills], 300)
        used["skills"] = skill_lines
        if skill_lines:
            sections.append("## Learned skills\n" + "\n".join(f"- {s}" for s in skill_lines))

        return {"prompt_block": "\n\n".join(sections), "used": used}


memory = MemoryService()
