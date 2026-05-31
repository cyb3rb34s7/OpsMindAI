from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from opsmindai.shared.trace import get_trace_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "event": getattr(record, "event", record.getMessage()),
            "trace_id": getattr(record, "trace_id", get_trace_id()),
            "message": record.getMessage(),
        }

        for key in ("customer_id", "agent", "provider", "status_code", "duration_ms"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)

        return json.dumps(payload, default=str)


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("opsmindai")
    if logger.handlers:
        return logger

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


logger = setup_logger()
