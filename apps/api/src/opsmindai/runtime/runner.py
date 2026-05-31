from __future__ import annotations

import json
from typing import Type

from pydantic import BaseModel

from opsmindai.agents.cognition.schemas import AgentMemory, CognitiveStep
from opsmindai.shared.llm.base.models import LLMRequest
from opsmindai.shared.llm.client import LLMClient
from opsmindai.tools.registry import get_tool, list_tools


class CognitiveRunner:
    def __init__(self, provider: str | None = None, max_iterations: int = 4) -> None:
        self.client = LLMClient(provider=provider)
        self.max_iterations = max_iterations

    def _tool_prompt(self) -> str:
        names = ", ".join(list_tools()) or "none"
        return f"Available tools: {names}"

    def _memory_prompt(self, memory: AgentMemory, tool_results: list[dict]) -> str:
        return json.dumps(
            {"memory": memory.model_dump(), "tool_results": tool_results},
            indent=2,
            default=str,
        )

    async def run(
        self,
        system_prompt: str,
        user_prompt: str,
        final_schema: Type[BaseModel],
    ) -> dict:
        memory = AgentMemory()
        step_log: list[dict] = []
        tool_results: list[dict] = []
        working_prompt = user_prompt

        for _ in range(self.max_iterations):
            step_request = LLMRequest(
                system_prompt=f"{system_prompt}\n\n{self._tool_prompt()}",
                user_prompt=f"{working_prompt}\n\n{self._memory_prompt(memory, tool_results)}",
                response_schema=CognitiveStep,
            )
            step_response = await self.client.generate(step_request)
            if step_response.structured_output is None:
                raise RuntimeError("Cognitive step returned no structured output")

            step = CognitiveStep.model_validate(step_response.structured_output)
            step_log.append(step.model_dump())

            memory.completed_actions.append(step.next_action)

            if step.selected_tool is None:
                break

            tool = get_tool(step.selected_tool)
            if tool is None:
                raise RuntimeError(f"Tool not registered: {step.selected_tool}")

            tool_result = await tool.execute(
                {
                    "user_prompt": user_prompt,
                    "working_prompt": working_prompt,
                    "memory": memory.model_dump(),
                    "step": step.model_dump(),
                }
            )
            tool_payload = {
                "tool": step.selected_tool,
                "success": tool_result.success,
                "data": tool_result.data,
                "error": tool_result.error,
            }
            tool_results.append(tool_payload)

            if tool_result.success:
                memory.findings.append(json.dumps(tool_result.data, default=str))
            else:
                memory.failed_attempts.append(step.selected_tool)
                memory.warnings.append(tool_result.error or "tool failed")

            working_prompt = json.dumps(
                {
                    "original_user_prompt": user_prompt,
                    "latest_step": step.model_dump(),
                    "tool_result": tool_payload,
                    "memory": memory.model_dump(),
                },
                indent=2,
                default=str,
            )

            if not step.requires_more_context:
                break

        final_request = LLMRequest(
            system_prompt=(
                f"{system_prompt}\n\nProduce a final JSON object that matches "
                f"{final_schema.__name__} exactly."
            ),
            user_prompt=json.dumps(
                {
                    "original_user_prompt": user_prompt,
                    "step_log": step_log,
                    "tool_results": tool_results,
                    "memory": memory.model_dump(),
                },
                indent=2,
                default=str,
            ),
            response_schema=final_schema,
        )
        final_response = await self.client.generate(final_request)
        if final_response.structured_output is None:
            raise RuntimeError("Final structured output was missing")

        final_output = final_schema.model_validate(final_response.structured_output)
        return {
            "final": final_output.model_dump(),
            "steps": step_log,
            "memory": memory.model_dump(),
            "tool_results": tool_results,
            "provider": final_response.provider,
            "model": final_response.model,
        }
