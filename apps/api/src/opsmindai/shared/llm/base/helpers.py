from __future__ import annotations

import json
import re
from typing import Type

from pydantic import BaseModel

from opsmindai.shared.llm.base.exceptions import StructuredOutputError


def schema_to_prompt(schema: Type[BaseModel] | None) -> str:
    if schema is None:
        return "Return valid JSON."

    return (
        "Return valid JSON that matches this schema exactly:\n"
        f"{json.dumps(schema.model_json_schema(), indent=2)}"
    )


def strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def parse_structured_output(
    content: str,
    schema: Type[BaseModel] | None,
) -> dict:
    cleaned = strip_code_fences(content)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise StructuredOutputError(
            f"Provider returned non-JSON structured output: {cleaned[:200]}"
        ) from exc

    if schema is None:
        return payload

    validated = schema.model_validate(payload)
    return validated.model_dump()
