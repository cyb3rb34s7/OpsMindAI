from pydantic import BaseModel, Field


class Component(BaseModel):
    """One service/module in the system."""

    name: str
    responsibility: str = ""
    tech: str = ""
    dependencies: list[str] = Field(default_factory=list)
    data_store: str = ""


class OnboardingReport(BaseModel):
    repo_name: str
    tech_stack: list[str]
    services: list[str]
    architecture_summary: str
    business_context: str = ""
    components: list[Component] = Field(default_factory=list)
    data_flows: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    key_decisions: list[str] = Field(default_factory=list)
    open_questions: list[str]
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    artifact_path: str | None = None
    context_repo_url: str | None = None
    context_repo_full_name: str | None = None
    source_repo_url: str | None = None
