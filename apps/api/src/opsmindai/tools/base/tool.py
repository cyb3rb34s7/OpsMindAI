from abc import ABC, abstractmethod

from opsmindai.tools.base.schemas import ToolResult


class BaseTool(ABC):
    name: str

    @abstractmethod
    async def execute(self, payload: dict) -> ToolResult:
        raise NotImplementedError
