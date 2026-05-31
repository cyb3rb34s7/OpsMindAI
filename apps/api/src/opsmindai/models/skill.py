from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Skill(SQLModel, table=True):
    id: str = Field(primary_key=True)

    customer_id: str
    agent_name: str

    failure_pattern: str
    resolution: str

    success_count: int = 0

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )