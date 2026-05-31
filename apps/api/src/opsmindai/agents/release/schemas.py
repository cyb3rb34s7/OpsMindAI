from pydantic import BaseModel, Field


class RegionResult(BaseModel):
    region: str
    status: str = "deployed"  # deployed | failed | skipped
    deployment_id: str = ""
    startup_health: str = ""  # healthy | failed
    sanity_passed: bool = True
    sanity: list[dict] = Field(default_factory=list)  # [{name, ok}]
    logs: list[str] = Field(default_factory=list)


class ReleaseReport(BaseModel):
    service: str = ""
    version: str = ""
    deployment_status: str  # released | partial | blocked
    regions: list[RegionResult] = Field(default_factory=list)
    infra_warnings: list[str] = Field(default_factory=list)
    changelog: list[str] = Field(default_factory=list)
    rollback_recommended: bool = False
    # legacy summary fields (kept for the existing console view)
    startup_health: str = ""
    sanity_results: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    artifact_path: str | None = None
