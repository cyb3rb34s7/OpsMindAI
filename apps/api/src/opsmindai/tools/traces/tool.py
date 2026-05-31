from __future__ import annotations

from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool

_LEVEL_RANK = {"info": 0, "debug": 0, "warn": 1, "warning": 1, "error": 2, "fatal": 3}


def _ts_to_seconds(ts: str) -> int | None:
    """Parse 'HH:MM:SS' (or the time part of an ISO stamp) into seconds."""
    if not ts:
        return None
    part = ts.split("T")[-1].split(".")[0]
    bits = part.split(":")
    if len(bits) != 3:
        return None
    try:
        h, m, s = (int(b) for b in bits)
    except ValueError:
        return None
    return h * 3600 + m * 60 + s


class CorrelateTraceTool(BaseTool):
    name = "correlate_trace"

    async def execute(self, payload: dict) -> ToolResult:
        logs = payload.get("logs")
        if not isinstance(logs, list) or not logs:
            return ToolResult(success=False, error="logs list is required")

        # Order spans chronologically — real correlation reconstructs the timeline
        # rather than trusting arrival order.
        def sort_key(entry: dict):
            secs = _ts_to_seconds(entry.get("ts", ""))
            return (secs if secs is not None else 0, entry.get("ts", ""))

        ordered = sorted(logs, key=sort_key)
        base = _ts_to_seconds(ordered[0].get("ts", "")) or 0

        timeline: list[dict] = []
        prev_secs = base
        services: list[str] = []
        break_point: dict | None = None

        for i, entry in enumerate(ordered):
            secs = _ts_to_seconds(entry.get("ts", ""))
            elapsed = (secs - base) if secs is not None else None
            delta = (secs - prev_secs) if secs is not None else None
            prev_secs = secs if secs is not None else prev_secs

            service = entry.get("service", "unknown")
            if service not in services:
                services.append(service)

            level = str(entry.get("level", "info")).lower()
            hop = {
                "seq": i + 1,
                "ts": entry.get("ts"),
                "service": service,
                "level": level,
                "message": entry.get("message", ""),
                "elapsed_s": elapsed,
                "delta_s": delta,
            }
            timeline.append(hop)
            if break_point is None and _LEVEL_RANK.get(level, 0) >= 2:
                break_point = hop

        trace_flow = [
            f"[+{h['elapsed_s']}s] {h['service']} ({h['level']}): {h['message']}"
            if h["elapsed_s"] is not None
            else f"{h['service']} ({h['level']}): {h['message']}"
            for h in timeline
        ]

        span = timeline[-1]["elapsed_s"] if timeline[-1]["elapsed_s"] is not None else "?"
        if break_point:
            summary = (
                f"Trace spans {len(services)} services over {span}s. "
                f"First failure at {break_point['service']} "
                f"(+{break_point['elapsed_s']}s): {break_point['message']}. "
                f"Path: {' -> '.join(services)}."
            )
        else:
            summary = (
                f"Trace spans {len(services)} services over {span}s with no errors. "
                f"Path: {' -> '.join(services)}."
            )

        return ToolResult(
            success=True,
            data={
                "span_count": len(timeline),
                "services": services,
                "timeline": timeline,
                "break_point": break_point,
                "trace_flow": trace_flow,
                "summary": summary,
            },
        )
