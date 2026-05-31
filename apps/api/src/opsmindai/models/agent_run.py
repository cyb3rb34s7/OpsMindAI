from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class AgentRun(SQLModel, table=True):
    id: str = Field(primary_key=True)

    customer_id: str
    agent_name: str
    status: str

    trace_id: str

    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    completed_at: Optional[datetime] = None

    duration_ms: Optional[int] = None

    input_payload: str
    output_payload: Optional[str] = None
    error_payload: Optional[str] = None