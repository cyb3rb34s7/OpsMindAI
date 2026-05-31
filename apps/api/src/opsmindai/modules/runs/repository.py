from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from opsmindai.shared.db import get_connection, init_db
from opsmindai.modules.runs.schemas import RunRecord


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_ready() -> None:
    init_db()


def create_run(
    *,
    trace_id: str,
    customer_id: str,
    agent_name: str,
    provider: str,
    input_json: dict,
) -> RunRecord:
    ensure_ready()
    now = _now()
    run_id = f"run_{uuid4().hex}"
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO runs (
                run_id, trace_id, customer_id, agent_name, status, provider,
                input_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                trace_id,
                customer_id,
                agent_name,
                "running",
                provider,
                json.dumps(input_json, default=str),
                now,
                now,
            ),
        )
        conn.commit()
    return get_run(run_id)


def update_run(
    run_id: str,
    *,
    status: str,
    output_json: dict | None = None,
    error_json: dict | None = None,
    debug_json: dict | None = None,
) -> RunRecord:
    ensure_ready()
    now = _now()
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE runs
            SET status = ?, output_json = ?, error_json = ?, debug_json = ?, updated_at = ?
            WHERE run_id = ?
            """,
            (
                status,
                json.dumps(output_json, default=str) if output_json is not None else None,
                json.dumps(error_json, default=str) if error_json is not None else None,
                json.dumps(debug_json, default=str) if debug_json is not None else None,
                now,
                run_id,
            ),
        )
        conn.commit()
    return get_run(run_id)


def _row_to_record(row: sqlite3.Row) -> RunRecord:
    return RunRecord(
        run_id=row["run_id"],
        trace_id=row["trace_id"],
        customer_id=row["customer_id"],
        agent_name=row["agent_name"],
        status=row["status"],
        provider=row["provider"],
        input_json=json.loads(row["input_json"]),
        output_json=json.loads(row["output_json"]) if row["output_json"] else None,
        error_json=json.loads(row["error_json"]) if row["error_json"] else None,
        debug_json=json.loads(row["debug_json"]) if row["debug_json"] else None,
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def get_run(run_id: str) -> RunRecord:
    ensure_ready()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM runs WHERE run_id = ?",
            (run_id,),
        ).fetchone()
    if row is None:
        raise KeyError(f"Run not found: {run_id}")
    return _row_to_record(row)


def list_runs(limit: int = 50) -> list[RunRecord]:
    ensure_ready()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM runs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [_row_to_record(row) for row in rows]


def find_runs_by_trace_id(trace_id: str) -> list[RunRecord]:
    ensure_ready()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM runs WHERE trace_id = ? ORDER BY created_at DESC",
            (trace_id,),
        ).fetchall()
    return [_row_to_record(row) for row in rows]
