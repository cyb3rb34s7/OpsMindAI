from pydantic import BaseModel, Field


class RepositoryScanResult(BaseModel):
    repo_name: str
    owner: str | None = None
    description: str | None = None
    default_branch: str | None = None
    languages: list[str] = Field(default_factory=list)
    readme: str | None = None
    files: list[str] = Field(default_factory=list)
    detected_configs: list[str] = Field(default_factory=list)
    file_count: int = 0
    truncated: bool = False
    html_url: str | None = None
    warnings: list[str] = Field(default_factory=list)
