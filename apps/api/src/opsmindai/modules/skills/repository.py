from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from opsmindai.shared.db import get_connection, init_db

_STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "was",
    "during", "with", "at", "by", "from", "error", "issue", "failure", "failed",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


def _row_to_skill(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "customer_id": row["customer_id"],
        "agent_name": row["agent_name"],
        "failure_pattern": row["failure_pattern"],
        "resolution": row["resolution"],
        "success_count": row["success_count"],
        "confidence": row["confidence"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def save_skill(
    *,
    customer_id: str,
    agent_name: str,
    failure_pattern: str,
    resolution: str,
    confidence: float,
) -> dict:
    """Upsert a skill for a customer.

    If a skill with the same (customer, failure_pattern) already exists we bump
    its success_count and refresh the resolution/confidence — this is what makes
    the agent 'learn': repeated incidents reinforce known playbooks.
    """
    init_db()
    now = _now()
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM skills WHERE customer_id = ? AND failure_pattern = ?",
            (customer_id, failure_pattern),
        ).fetchone()
        if existing is not None:
            conn.execute(
                """
                UPDATE skills
                SET success_count = success_count + 1,
                    resolution = ?,
                    confidence = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (resolution, confidence, now, existing["id"]),
            )
            conn.commit()
            skill_id = existing["id"]
        else:
            skill_id = f"skill_{uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO skills (
                    id, customer_id, agent_name, failure_pattern, resolution,
                    success_count, confidence, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
                """,
                (skill_id, customer_id, agent_name, failure_pattern, resolution,
                 confidence, now, now),
            )
            conn.commit()

    with get_connection() as conn:
        row = conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
    return _row_to_skill(row)


def list_skills(customer_id: str) -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM skills WHERE customer_id = ? ORDER BY success_count DESC, updated_at DESC",
            (customer_id,),
        ).fetchall()
    return [_row_to_skill(r) for r in rows]


def find_relevant_skills(customer_id: str, query_text: str, limit: int = 3) -> list[dict]:
    """Return prior skills whose failure_pattern overlaps the incident text.

    Lightweight keyword-overlap ranking — enough to surface 'you've seen this
    before' without a vector store. Skills with zero overlap are excluded.
    """
    query_tokens = _tokens(query_text)
    if not query_tokens:
        return []
    scored: list[tuple[int, int, dict]] = []
    for skill in list_skills(customer_id):
        overlap = len(query_tokens & _tokens(skill["failure_pattern"]))
        if overlap > 0:
            scored.append((overlap, skill["success_count"], skill))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [s for _, _, s in scored[:limit]]
