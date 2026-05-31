from __future__ import annotations

import json

from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool
from opsmindai.tools.github.client import (
    GitHubClient,
    GitHubCredentialProvider,
    GitHubError,
)


def _extract_repo_url(payload: dict) -> str | None:
    """Find a repo_url in the payload.

    The agent calls this tool directly with {"repo_url": ...}. The cognitive
    runner calls it with {"user_prompt", "working_prompt", ...}, so we also dig
    the URL out of those JSON-encoded prompts when needed.
    """
    if payload.get("repo_url"):
        return payload["repo_url"]
    for key in ("user_prompt", "working_prompt"):
        blob = payload.get(key)
        if not isinstance(blob, str):
            continue
        try:
            parsed = json.loads(blob)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(parsed, dict) and parsed.get("repo_url"):
            return parsed["repo_url"]
    return None


class GitHubScannerTool(BaseTool):
    name = "scan_repository"

    def __init__(self, credentials: GitHubCredentialProvider | None = None) -> None:
        self.credentials = credentials or GitHubCredentialProvider()

    async def execute(self, payload: dict) -> ToolResult:
        repo_url = _extract_repo_url(payload)
        if not repo_url:
            return ToolResult(success=False, error="repo_url is required")

        customer_id = payload.get("customer_id", "default")
        token = self.credentials.get_token(customer_id)
        client = GitHubClient(token=token)
        try:
            data = await client.scan_repository(repo_url)
        except GitHubError as exc:
            return ToolResult(success=False, error=str(exc))
        except Exception as exc:  # network / API failure -> partial, not a crash
            return ToolResult(
                success=False,
                error=f"GitHub scan failed: {exc}",
            )
        return ToolResult(success=True, data=data)
