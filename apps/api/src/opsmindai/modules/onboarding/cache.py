from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from opsmindai.shared.db import get_connection, init_db


def context_hash(payload: dict) -> str:
    """Stable hash of the inputs that affect onboarding output.

    Changing the repo or any pasted context invalidates the cache; unrelated
    fields (e.g. max_iterations) do not.
    """
    material = {
        "repo_url": payload.get("repo_url", ""),
        "business_context": payload.get("business_context", ""),
        "decisions": payload.get("decisions", ""),
        "transcripts": payload.get("transcripts", ""),
        "extra_docs": payload.get("extra_docs", ""),
    }
    blob = json.dumps(material, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def get_cached(customer_id: str, repo_url: str, chash: str) -> dict | None:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT result_json, context_hash FROM onboarding_cache WHERE customer_id = ? AND repo_url = ?",
            (customer_id, repo_url),
        ).fetchone()
    if row is None or row["context_hash"] != chash:
        return None
    return json.loads(row["result_json"])


def put_cached(customer_id: str, repo_url: str, chash: str, result: dict) -> None:
    init_db()
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO onboarding_cache (customer_id, repo_url, context_hash, result_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(customer_id, repo_url)
            DO UPDATE SET context_hash = excluded.context_hash,
                          result_json = excluded.result_json,
                          created_at = excluded.created_at
            """,
            (customer_id, repo_url, chash, json.dumps(result, default=str), now),
        )
        conn.commit()
