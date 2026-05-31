from datetime import datetime
from pydantic import BaseModel, Field


class RunRecord(BaseModel):
    run_id: str
    trace_id: str
    customer_id: str
    agent_name: str
    status: str
    provider: str
    input_json: dict = Field(default_factory=dict)
    output_json: dict | None = None
    error_json: dict | None = None
    debug_json: dict | None = None
    created_at: datetime
    updated_at: datetime
