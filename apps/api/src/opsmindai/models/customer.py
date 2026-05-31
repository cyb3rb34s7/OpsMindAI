from datetime import datetime, timezone
from sqlmodel import Field, SQLModel


class Customer(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )