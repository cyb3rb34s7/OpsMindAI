from __future__ import annotations

import asyncio
import json
import random
from time import perf_counter
from typing import Any

import boto3
import httpx
from pydantic import BaseModel

from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.exceptions import LLMProviderError
from opsmindai.shared.llm.base.helpers import parse_structured_output, schema_to_prompt
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse


def _usage_tokens(data: dict[str, Any]) -> int:
    usage = data.get("usage") or {}
    return int(usage.get("total_tokens") or usage.get("input_tokens") or 0)


def _content_with_schema(request: LLMRequest) -> str:
    return f"""{request.system_prompt}

{schema_to_prompt(request.response_schema)}"""


async def _post_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str],
    json: dict[str, Any],
    max_attempts: int = 8,
) -> httpx.Response:
    """POST with jittered exponential backoff on 429/5xx.

    Free-tier providers (e.g. OpenRouter's :free models) suffer intermittent
    upstream congestion that 429s ~half of rapid sequential calls. The cognitive
    loop makes several such calls per run, so without retries a run fails often.
    We honor Retry-After when present, otherwise back off exponentially with
    jitter so concurrent retries don't resynchronize into the same window.
    """
    backoff = 0.8
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        response = await client.post(url, headers=headers, json=json)
        if response.status_code not in (429, 500, 502, 503, 504):
            return response
        last_exc = httpx.HTTPStatusError(
            f"retryable status {response.status_code}",
            request=response.request,
            response=response,
        )
        if attempt == max_attempts - 1:
            break
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            delay = float(retry_after)
        else:
            delay = min(backoff, 8.0) + random.uniform(0, 0.6)
        await asyncio.sleep(delay)
        backoff *= 1.7
    assert last_exc is not None
    raise last_exc


async def openai_compatible_generate(
    *,
    provider: str,
    base_url: str,
    api_key: str | None,
    model: str,
    request: LLMRequest,
    extra_headers: dict[str, str] | None = None,
    fallback_models: list[str] | None = None,
) -> LLMResponse:
    if not api_key:
        raise LLMProviderError(f"{provider} API key is missing")

    headers = {"Authorization": f"Bearer {api_key}"}
    if extra_headers:
        headers.update(extra_headers)

    models = [model, *(fallback_models or [])]
    last_exc: Exception | None = None

    async with httpx.AsyncClient(base_url=base_url, timeout=settings.request_timeout_seconds) as client:
        for candidate in models:
            payload: dict[str, Any] = {
                "model": candidate,
                "messages": [
                    {"role": "system", "content": _content_with_schema(request)},
                    {"role": "user", "content": request.user_prompt},
                ],
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            }
            if request.response_schema is not None:
                payload["response_format"] = {"type": "json_object"}

            start = perf_counter()
            try:
                response = await _post_with_retry(
                    client, "/chat/completions", headers=headers, json=payload
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                # Primary congested even after retries — try the next model.
                last_exc = exc
                continue

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            structured = parse_structured_output(content, request.response_schema)
            return LLMResponse(
                content=content,
                structured_output=structured,
                provider=provider,
                model=candidate,
                latency_ms=int((perf_counter() - start) * 1000),
                tokens_used=_usage_tokens(data),
                finish_reason=data["choices"][0].get("finish_reason", "stop"),
            )

    raise last_exc if last_exc else LLMProviderError(f"{provider} generation failed")


async def anthropic_generate(
    *,
    api_key: str | None,
    model: str,
    request: LLMRequest,
) -> LLMResponse:
    if not api_key:
        raise LLMProviderError("Anthropic API key is missing")

    start = perf_counter()
    payload = {
        "model": model,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
        "system": _content_with_schema(request),
        "messages": [{"role": "user", "content": request.user_prompt}],
    }

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    content = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if isinstance(block, dict)
    )
    structured = parse_structured_output(content, request.response_schema)
    return LLMResponse(
        content=content,
        structured_output=structured,
        provider="claude",
        model=model,
        latency_ms=int((perf_counter() - start) * 1000),
        tokens_used=int(data.get("usage", {}).get("input_tokens", 0))
        + int(data.get("usage", {}).get("output_tokens", 0)),
        finish_reason=data.get("stop_reason", "stop"),
    )


async def ollama_generate(
    *,
    base_url: str,
    model: str,
    request: LLMRequest,
) -> LLMResponse:
    start = perf_counter()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _content_with_schema(request)},
            {"role": "user", "content": request.user_prompt},
        ],
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        },
        "stream": False,
    }

    async with httpx.AsyncClient(base_url=base_url, timeout=settings.request_timeout_seconds) as client:
        response = await client.post("/api/chat", json=payload)
        response.raise_for_status()
        data = response.json()

    content = data.get("message", {}).get("content", "")
    structured = parse_structured_output(content, request.response_schema)
    return LLMResponse(
        content=content,
        structured_output=structured,
        provider="ollama",
        model=model,
        latency_ms=int((perf_counter() - start) * 1000),
        tokens_used=int(data.get("prompt_eval_count", 0)) + int(data.get("eval_count", 0)),
        finish_reason="stop",
    )


async def bedrock_generate(
    *,
    region: str,
    model: str,
    request: LLMRequest,
) -> LLMResponse:
    def _invoke():
        client = boto3.client("bedrock-runtime", region_name=region)
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "system": _content_with_schema(request),
            "messages": [{"role": "user", "content": request.user_prompt}],
        }
        response = client.invoke_model(
            modelId=model,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        raw = response["body"].read().decode("utf-8")
        return json.loads(raw)

    start = perf_counter()
    data = await asyncio.to_thread(_invoke)
    content = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if isinstance(block, dict)
    )
    structured = parse_structured_output(content, request.response_schema)
    return LLMResponse(
        content=content,
        structured_output=structured,
        provider="bedrock",
        model=model,
        latency_ms=int((perf_counter() - start) * 1000),
        tokens_used=int(data.get("usage", {}).get("input_tokens", 0))
        + int(data.get("usage", {}).get("output_tokens", 0)),
        finish_reason=data.get("stop_reason", "stop"),
    )
