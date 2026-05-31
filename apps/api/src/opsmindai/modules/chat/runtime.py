"""Per-(customer, thread) concurrency: serialize turns (queue) + interrupt (stop).

One active turn per thread. A second request awaits the thread lock (so it is
effectively queued and runs when the current turn finishes). Stop cancels the
running turn's asyncio task, which unwinds the agent through its awaits.
"""
from __future__ import annotations

import asyncio

_locks: dict[str, asyncio.Lock] = {}
_tasks: dict[str, asyncio.Task] = {}


def _key(customer_id: str, thread_id: str) -> str:
    return f"{customer_id}:{thread_id}"


def lock_for(customer_id: str, thread_id: str) -> asyncio.Lock:
    key = _key(customer_id, thread_id)
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    return lock


def is_busy(customer_id: str, thread_id: str) -> bool:
    lock = _locks.get(_key(customer_id, thread_id))
    return bool(lock and lock.locked())


def register_task(customer_id: str, thread_id: str, task: asyncio.Task) -> None:
    _tasks[_key(customer_id, thread_id)] = task


def clear_task(customer_id: str, thread_id: str) -> None:
    _tasks.pop(_key(customer_id, thread_id), None)


def stop(customer_id: str, thread_id: str) -> bool:
    """Cancel the running turn for a thread. Returns True if one was cancelled."""
    task = _tasks.get(_key(customer_id, thread_id))
    if task and not task.done():
        task.cancel()
        return True
    return False
