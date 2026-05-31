from __future__ import annotations

import json


def build_rca_context(logs: list[dict], trace_flow: list[str]) -> dict:
    return {
        "logs": logs,
        "trace_flow": trace_flow,
        "evidence_summary": json.dumps(
            {"log_count": len(logs), "trace_steps": len(trace_flow)},
            indent=2,
        ),
    }
