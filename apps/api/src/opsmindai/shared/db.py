from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from opsmindai.shared.config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                customer_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                status TEXT NOT NULL,
                provider TEXT NOT NULL,
                input_json TEXT NOT NULL,
                output_json TEXT,
                error_json TEXT,
                debug_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tool_runs (
                tool_run_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                status TEXT NOT NULL,
                input_json TEXT NOT NULL,
                output_json TEXT,
                error_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        # Memory store: one FTS5 table holds all tiers (content indexed for BM25;
        # metadata columns UNINDEXED for filtering). customer_id namespaces every
        # row so store and recall use the exact same key.
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
                content,
                customer_id UNINDEXED,
                category UNINDEXED,
                thread_id UNINDEXED,
                importance UNINDEXED,
                created_at UNINDEXED,
                tokenize = 'porter'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS onboarding_cache (
                customer_id TEXT NOT NULL,
                repo_url TEXT NOT NULL,
                context_hash TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (customer_id, repo_url)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                failure_pattern TEXT NOT NULL,
                resolution TEXT NOT NULL,
                success_count INTEGER NOT NULL DEFAULT 1,
                confidence REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        # A connected Telegram bot per tenant. One row = one always-on poller the
        # gateway resumes on startup. Token is the user's own bot token.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS telegram_bots (
                customer_id TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                bot_username TEXT NOT NULL,
                bot_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


@contextmanager
def get_connection():
    conn = sqlite3.connect(settings.database_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
