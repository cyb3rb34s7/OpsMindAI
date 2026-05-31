from datetime import datetime, timezone

from pydantic import BaseModel, Field


class Incident(BaseModel):
    id: str
    customer_id: str

    service: str
    severity: str

    description: str

    trace_id: str | None = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )