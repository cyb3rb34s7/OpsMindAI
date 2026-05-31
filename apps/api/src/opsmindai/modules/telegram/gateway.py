"""Telegram gateway — connect a user's bot and run it as an always-on agent.

Transport is **long-polling** (Telegram getUpdates), which is how self-hosted
agents like Hermes and OpenClaw default for local deployments: the gateway makes
outbound calls, so no public URL / tunnel is needed. (Webhook mode is the cloud
optimization both offer so idle machines can sleep — designed-for, not built here.)

Telegram allows only ONE active getUpdates consumer per bot token, so connecting
a bot always stops any existing poller for that tenant first.

Each Telegram chat maps to a conversation thread `tg-<chat_id>` and is run through
the SAME chat turn pipeline (route → agents → memory) as the web console — so the
bot and the dashboard share one brain and one memory, and every message is visible
in the sessions mirror.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from opsmindai.modules.chat.runtime import lock_for
from opsmindai.modules.chat.service import run_turn
from opsmindai.shared.db import get_connection, init_db
from opsmindai.shared.logging import logger

API = "https://api.telegram.org"
POLL_TIMEOUT_S = 30  # Telegram long-poll hold time
TURN_TIMEOUT_S = 240  # bound a turn so a throttled provider never wedges the bot


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TelegramAPIError(Exception):
    """A Telegram API call returned ok=false (e.g. invalid token)."""


async def _call(token: str, method: str, *, client_timeout: float = 15.0, **params) -> dict:
    # `client_timeout` is the HTTP read timeout; any other kwargs (including a
    # Telegram `timeout` long-poll param) pass straight through as query params.
    async with httpx.AsyncClient(timeout=client_timeout) as client:
        resp = await client.get(f"{API}/bot{token}/{method}", params=params)
    data = resp.json()
    if not data.get("ok"):
        raise TelegramAPIError(data.get("description", f"{method} failed"))
    return data.get("result", {})


class BotRuntime:
    """One connected bot: its poll loop, offset cursor, and last-seen activity."""

    def __init__(self, customer_id: str, token: str, username: str, name: str):
        self.customer_id = customer_id
        self.token = token
        self.username = username
        self.name = name
        self.offset = 0
        self.task: asyncio.Task | None = None
        self.messages = 0
        self.last_error: str | None = None

    async def _poll_loop(self) -> None:
        logger.info("telegram.poll.start", extra={"event": "telegram.poll.start", "customer_id": self.customer_id, "bot": self.username})
        while True:
            try:
                updates = await _call(
                    self.token, "getUpdates",
                    client_timeout=POLL_TIMEOUT_S + 10,
                    offset=self.offset, timeout=POLL_TIMEOUT_S,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # network blip / 409 conflict — back off, retry
                self.last_error = str(exc)
                logger.warning("telegram.poll.error", extra={"event": "telegram.poll.error", "error": str(exc)})
                await asyncio.sleep(3)
                continue
            for upd in updates:
                self.offset = max(self.offset, upd.get("update_id", 0) + 1)
                await self._handle(upd)

    async def _handle(self, update: dict) -> None:
        msg = update.get("message") or update.get("edited_message")
        if not msg:
            return
        text = (msg.get("text") or "").strip()
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        if not text or chat_id is None:
            return
        logger.info("telegram.message.in", extra={"event": "telegram.message.in", "chat_id": chat_id, "text": text[:60]})

        # /start is a Telegram convention — greet instead of routing it to an agent.
        if text == "/start":
            await self._send(chat_id, "👋 OpsMindAI here. Ask me about an incident (paste a trace id), a release, or your system architecture.")
            return

        thread_id = f"tg-{chat_id}"
        reply_holder: dict[str, str] = {}

        async def emit(event_type: str, data: dict) -> None:
            if event_type == "reply" and data.get("text"):
                reply_holder["text"] = data["text"]

        # Telegram's typing action only lasts ~5s, but a local-model turn can take
        # much longer — so re-send it on a timer for the whole turn, otherwise the
        # chat looks dead until the reply lands.
        typing = asyncio.create_task(self._typing_keepalive(chat_id))
        try:
            async with lock_for(self.customer_id, thread_id):
                await asyncio.wait_for(
                    run_turn(self.customer_id, thread_id, text, emit, provider=None),
                    timeout=TURN_TIMEOUT_S,
                )
            self.messages += 1
        except asyncio.TimeoutError:
            reply_holder.setdefault("text", "The model is busy right now — try again in a moment.")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("telegram.turn.error", extra={"event": "telegram.turn.error", "error": str(exc)})
            reply_holder.setdefault("text", "Something went wrong handling that. Please try again.")
        finally:
            typing.cancel()

        out = reply_holder.get("text") or "(no reply)"
        logger.info("telegram.reply.out", extra={"event": "telegram.reply.out", "chat_id": chat_id, "text": out[:60]})
        await self._send(chat_id, out)

    async def _send(self, chat_id: int, text: str) -> None:
        try:
            await _call(self.token, "sendMessage", chat_id=chat_id, text=text)
        except Exception as exc:
            logger.warning("telegram.send.error", extra={"event": "telegram.send.error", "error": str(exc)})

    async def _send_action(self, chat_id: int, action: str) -> None:
        try:
            await _call(self.token, "sendChatAction", chat_id=chat_id, action=action)
        except Exception as exc:
            logger.warning("telegram.action.error", extra={"event": "telegram.action.error", "error": str(exc)})

    async def _typing_keepalive(self, chat_id: int) -> None:
        """Hold the 'typing…' indicator until the turn finishes (cancelled by caller)."""
        try:
            while True:
                await self._send_action(chat_id, "typing")
                await asyncio.sleep(4)
        except asyncio.CancelledError:
            pass


# Module-level registry: one runtime per tenant, in-process.
_bots: dict[str, BotRuntime] = {}


def _persist(rt: BotRuntime) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO telegram_bots (customer_id, token, bot_username, bot_name, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(customer_id) DO UPDATE SET
                token = excluded.token,
                bot_username = excluded.bot_username,
                bot_name = excluded.bot_name,
                created_at = excluded.created_at
            """,
            (rt.customer_id, rt.token, rt.username, rt.name, _now()),
        )
        conn.commit()


def _forget(customer_id: str) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM telegram_bots WHERE customer_id = ?", (customer_id,))
        conn.commit()


def _start_task(rt: BotRuntime) -> None:
    rt.task = asyncio.create_task(rt._poll_loop())


async def _stop(customer_id: str) -> None:
    """Stop and remove any running poller for this tenant (enforces one-per-token)."""
    rt = _bots.pop(customer_id, None)
    if rt and rt.task and not rt.task.done():
        rt.task.cancel()
        try:
            await rt.task
        except (asyncio.CancelledError, Exception):
            pass


async def connect(customer_id: str, token: str, name: str) -> dict:
    """Validate the token via getMe, persist, and start polling. Idempotent —
    reconnecting replaces the existing poller."""
    token = (token or "").strip()
    if not token:
        raise TelegramAPIError("Bot token is required.")
    me = await _call(token, "getMe")  # raises TelegramAPIError on a bad token
    username = me.get("username", "")
    display = name.strip() or me.get("first_name", "") or username

    await _stop(customer_id)
    rt = BotRuntime(customer_id, token, username, display)
    _bots[customer_id] = rt
    _persist(rt)
    _start_task(rt)
    logger.info("telegram.connected", extra={"event": "telegram.connected", "customer_id": customer_id, "bot": username})
    return {"connected": True, "bot_username": username, "bot_name": display}


async def disconnect(customer_id: str) -> dict:
    await _stop(customer_id)
    _forget(customer_id)
    logger.info("telegram.disconnected", extra={"event": "telegram.disconnected", "customer_id": customer_id})
    return {"connected": False}


def status(customer_id: str) -> dict:
    rt = _bots.get(customer_id)
    if rt is None:
        # Might be persisted but not yet resumed (e.g. before startup hook ran).
        init_db()
        with get_connection() as conn:
            row = conn.execute(
                "SELECT bot_username, bot_name FROM telegram_bots WHERE customer_id = ?",
                (customer_id,),
            ).fetchone()
        if row is None:
            return {"connected": False}
        return {"connected": True, "bot_username": row["bot_username"], "bot_name": row["bot_name"], "running": False, "messages": 0}
    return {
        "connected": True,
        "bot_username": rt.username,
        "bot_name": rt.name,
        "running": bool(rt.task and not rt.task.done()),
        "messages": rt.messages,
        "last_error": rt.last_error,
    }


async def resume_all() -> None:
    """On startup, restart pollers for every persisted bot."""
    init_db()
    with get_connection() as conn:
        rows = conn.execute("SELECT customer_id, token, bot_username, bot_name FROM telegram_bots").fetchall()
    for row in rows:
        if row["customer_id"] in _bots:
            continue
        rt = BotRuntime(row["customer_id"], row["token"], row["bot_username"], row["bot_name"])
        _bots[row["customer_id"]] = rt
        _start_task(rt)
    if rows:
        logger.info("telegram.resumed", extra={"event": "telegram.resumed", "count": len(rows)})
