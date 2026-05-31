from pydantic import BaseModel, Field


class OnboardingReport(BaseModel):
    repo_name: str
    tech_stack: list[str]
    services: list[str]
    architecture_summary: str
    open_questions: list[str]
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    artifact_path: str | None = None
    context_repo_url: str | None = None
    context_repo_full_name: str | None = None
    source_repo_url: str | None = None
