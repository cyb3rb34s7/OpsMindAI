from pydantic import BaseModel, Field


class ReleaseReport(BaseModel):
    deployment_status: str
    infra_warnings: list[str]
    startup_health: str
    sanity_results: list[str]
    rollback_recommended: bool
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    artifact_path: str | None = None
