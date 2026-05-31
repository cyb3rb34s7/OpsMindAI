from pydantic import BaseModel, Field


class CognitiveStep(BaseModel):
    """One reasoning step in the cognitive loop.

    Every field is defaulted so that weaker/free models which don't perfectly
    follow the step schema (e.g. returning answer-shaped JSON) still validate:
    missing tool selection simply ends the loop and proceeds to final synthesis,
    rather than crashing the whole run.
    """

    model_config = {"extra": "ignore"}

    thought: str = ""
    reasoning: str = ""
    confidence: float = 0.5
    selected_tool: str | None = None
    next_action: str = ""
    expected_outcome: str = ""
    requires_more_context: bool = False


class AgentMemory(BaseModel):
    findings: list[str] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    completed_actions: list[str] = Field(default_factory=list)
    failed_attempts: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class RouteDecision(BaseModel):
    intent: str
    confidence: float
    reasoning: str
