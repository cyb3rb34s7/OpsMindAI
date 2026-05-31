from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ToolRun(SQLModel, table=True):
    id: str = Field(primary_key=True)

    agent_run_id: str

    tool_name: str
    status: str

    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    completed_at: Optional[datetime] = None

    input_payload: str
    output_payload: Optional[str] = None
    error_payload: Optional[str] = None