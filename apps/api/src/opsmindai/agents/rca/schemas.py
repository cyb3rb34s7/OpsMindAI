from pydantic import BaseModel, Field


class RCAReport(BaseModel):
    root_cause: str
    confidence: float
    impacted_services: list[str]
    trace_flow: list[str]
    recommendations: list[str]
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    artifact_path: str | None = None
    applied_skills: list[str] = Field(default_factory=list)
