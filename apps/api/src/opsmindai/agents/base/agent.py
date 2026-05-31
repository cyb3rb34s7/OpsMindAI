from __future__ import annotations

from abc import ABC, abstractmethod
from time import perf_counter

from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.shared.logging import logger


class BaseAgent(ABC):
    name: str

    async def run(self, context: ExecutionContext, payload: dict) -> AgentResult:
        start = perf_counter()
        logger.info(
            "agent.run.started",
            extra={
                "event": "agent.run.started",
                "agent": self.name,
                "customer_id": context.customer_id,
            },
        )

        if context.iteration >= context.max_iterations:
            raise RuntimeError("Max iterations exceeded")

        result = await self.execute(context, payload)

        logger.info(
            "agent.run.completed",
            extra={
                "event": "agent.run.completed",
                "agent": self.name,
                "duration_ms": int((perf_counter() - start) * 1000),
            },
        )
        return result

    @abstractmethod
    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        raise NotImplementedError
