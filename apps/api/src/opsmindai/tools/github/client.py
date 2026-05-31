from __future__ import annotations

import base64
import re
from typing import Any

import httpx

from opsmindai.shared.config import settings

CONFIG_FILENAMES = {
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "requirements.txt",
    "pyproject.toml",
    "package.json",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "cargo.toml",
    "makefile",
    "serverless.yml",
    "serverless.yaml",
}
CONFIG_SUFFIXES = (".yml", ".yaml", ".tf", ".toml")
CONFIG_DIR_HINTS = (".github/workflows/", "k8s/", "kubernetes/", "helm/", "deploy/", "infra/")

# Bounded content reading: regardless of repo size we read the contents of at
# most MAX_CONTENT_FILES high-signal files, each capped — so token cost is fixed.
MAX_CONTENT_FILES = 10
CONTENT_CHAR_CAP = 1800
MAX_BLOB_BYTES = 80_000

_ORCHESTRATION_FILES = {"skaffold.yaml", "skaffold.yml", "docker-compose.yml", "docker-compose.yaml"}
_ORCHESTRATION_DIRS = ("kubernetes-manifests", "release/", "kustomize", "/helm", "k8s/", "deploy/")
_LANG_MANIFESTS = {
    "package.json", "requirements.txt", "pyproject.toml", "go.mod", "pom.xml",
    "build.gradle", "cargo.toml", "gemfile", "composer.json", "setup.py",
}
_ENTRYPOINT_RE = re.compile(r"(^|/)(main|app|server|index)\.(go|py|js|ts|java|cs|rb|cpp|rs)$", re.IGNORECASE)
_NOISE_DIRS = ("node_modules/", "vendor/", "dist/", "build/", ".git/", "test", "mock")


def _signal_score(path: str) -> int:
    """Lower is higher priority. Returns 99 for files we never read."""
    lower = path.lower()
    name = lower.rsplit("/", 1)[-1]
    if any(n in lower for n in _NOISE_DIRS):
        return 99
    if "/" not in path and (lower.endswith(".md") or lower.endswith(".txt")):
        return 0  # top-level docs (ARCHITECTURE.md, etc.)
    if name in _ORCHESTRATION_FILES or any(d in lower for d in _ORCHESTRATION_DIRS):
        return 1  # topology / manifests
    if name in _LANG_MANIFESTS:
        return 2
    if name == "dockerfile":
        return 3
    if _ENTRYPOINT_RE.search(path):
        return 4
    return 99


def _select_high_signal(tree_nodes: list[dict]) -> list[dict]:
    """Pick the highest-signal blobs to read, bounded by count and size."""
    candidates = []
    for n in tree_nodes:
        if n.get("type") != "blob":
            continue
        size = n.get("size") or 0
        if size > MAX_BLOB_BYTES:
            continue
        score = _signal_score(n["path"])
        if score >= 99:
            continue
        depth = n["path"].count("/")
        candidates.append((score, depth, size, n))
    candidates.sort(key=lambda c: (c[0], c[1], c[2]))
    return [c[3] for c in candidates[:MAX_CONTENT_FILES]]


class GitHubError(RuntimeError):
    """Raised when a GitHub API call fails in a way the caller must surface."""


class GitHubCredentialProvider:
    """Resolves a GitHub token for a given customer.

    Demo: returns a single shared PAT from settings.
    Production seam: replace ``get_token`` with GitHub App installation-token
    minting (store an ``installation_id`` per customer, sign a JWT with the app
    private key, exchange it for a short-lived org-scoped token). Every caller
    depends only on ``get_token(customer_id)``, so that swap stays local here.
    """

    def __init__(self, default_token: str | None = None) -> None:
        self._default_token = default_token if default_token is not None else settings.github_token

    def get_token(self, customer_id: str) -> str | None:
        return self._default_token


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract (owner, repo) from a GitHub URL or 'owner/repo' shorthand."""
    cleaned = repo_url.strip().rstrip("/")
    cleaned = re.sub(r"\.git$", "", cleaned)
    match = re.search(r"github\.com[:/]([^/]+)/([^/]+)$", cleaned)
    if match:
        return match.group(1), match.group(2)
    parts = cleaned.split("/")
    if len(parts) >= 2:
        return parts[-2], parts[-1]
    raise GitHubError(f"Could not parse owner/repo from '{repo_url}'")


def _classify_config(path: str) -> bool:
    lower = path.lower()
    name = lower.rsplit("/", 1)[-1]
    if name in CONFIG_FILENAMES:
        return True
    if lower.endswith(CONFIG_SUFFIXES):
        return True
    return any(hint in lower for hint in CONFIG_DIR_HINTS)


class GitHubClient:
    def __init__(self, token: str | None) -> None:
        self.token = token
        self.api = settings.github_api_url.rstrip("/")
        self._login: str | None = None

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "OpsMindAI",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def _get_login(self, client: httpx.AsyncClient) -> str:
        if self._login is None:
            resp = await client.get(f"{self.api}/user", headers=self._headers())
            resp.raise_for_status()
            self._login = resp.json()["login"]
        return self._login

    async def scan_repository(self, repo_url: str) -> dict[str, Any]:
        """Real scan: metadata, README, file tree, detected configs.

        Honors the large-codebase edge case: if the tree exceeds the configured
        threshold (or GitHub truncates it), we keep only top-level files plus
        detected config files and flag a warning rather than reading everything.
        """
        owner, repo = parse_repo_url(repo_url)
        warnings: list[str] = []

        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            meta_resp = await client.get(f"{self.api}/repos/{owner}/{repo}", headers=self._headers())
            if meta_resp.status_code == 404:
                raise GitHubError(f"Repository not found or not accessible: {owner}/{repo}")
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            default_branch = meta.get("default_branch", "main")

            # README (optional)
            readme_text = ""
            readme_resp = await client.get(
                f"{self.api}/repos/{owner}/{repo}/readme", headers=self._headers()
            )
            if readme_resp.status_code == 200:
                raw = readme_resp.json().get("content", "")
                try:
                    readme_text = base64.b64decode(raw).decode("utf-8", errors="replace")[:4000]
                except (ValueError, TypeError):
                    readme_text = ""
            else:
                warnings.append("No README found in repository.")

            # File tree (recursive)
            tree_resp = await client.get(
                f"{self.api}/repos/{owner}/{repo}/git/trees/{default_branch}",
                params={"recursive": "1"},
                headers=self._headers(),
            )
            tree_resp.raise_for_status()
            tree_data = tree_resp.json()
            blobs = [n["path"] for n in tree_data.get("tree", []) if n.get("type") == "blob"]

            # Languages
            lang_resp = await client.get(
                f"{self.api}/repos/{owner}/{repo}/languages", headers=self._headers()
            )
            languages = list(lang_resp.json().keys()) if lang_resp.status_code == 200 else []

            # Bounded content read: fetch the contents of high-signal files so the
            # agent reasons from real code, not just filenames. Capped by count
            # and size, so cost is fixed regardless of repo size.
            file_contents: dict[str, str] = {}
            for node in _select_high_signal(tree_data.get("tree", [])):
                text = await self._fetch_blob(client, owner, repo, node["sha"])
                if text:
                    file_contents[node["path"]] = text[:CONTENT_CHAR_CAP]

        file_count = len(blobs)
        truncated = bool(tree_data.get("truncated")) or file_count > settings.large_repo_file_threshold

        detected_configs = [p for p in blobs if _classify_config(p)]

        if truncated:
            warnings.append(
                f"Large codebase detected ({file_count}+ files) — scanning top-level "
                "structure, config files, and README only. Run a deep scan per service "
                "for full coverage."
            )
            top_level = [p for p in blobs if "/" not in p]
            files = sorted(set(top_level + detected_configs))[:120]
        else:
            files = blobs[:300]

        return {
            "repo_name": repo,
            "owner": owner,
            "description": meta.get("description") or "",
            "default_branch": default_branch,
            "languages": languages,
            "readme": readme_text or f"(no README) repository {owner}/{repo}",
            "files": files,
            "detected_configs": detected_configs[:60],
            "file_count": file_count,
            "truncated": truncated,
            "html_url": meta.get("html_url", f"https://github.com/{owner}/{repo}"),
            "file_contents": file_contents,
            "warnings": warnings,
        }

    async def _fetch_blob(self, client: httpx.AsyncClient, owner: str, repo: str, sha: str) -> str:
        try:
            resp = await client.get(
                f"{self.api}/repos/{owner}/{repo}/git/blobs/{sha}", headers=self._headers()
            )
            if resp.status_code != 200:
                return ""
            data = resp.json()
            if data.get("encoding") == "base64":
                return base64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")
            return data.get("content", "")
        except (httpx.HTTPError, ValueError):
            return ""

    async def commit_context_files(
        self,
        host_repo_full_name: str,
        base_path: str,
        files: dict[str, str],
        description: str,
    ) -> dict[str, Any]:
        """Commit markdown files into ``base_path`` of an existing host repo.

        Demo model: every customer gets a folder (``customers/<id>/``) in one
        shared org context repo, because the demo's fine-grained PAT is scoped to
        selected repos and cannot write to freshly created ones.

        Production model (GitHub App): each customer gets their OWN private repo
        in their OWN org, and ``base_path`` collapses to the repo root. The commit
        logic below is identical — only the credential + target repo change, which
        is exactly what ``GitHubCredentialProvider`` is the seam for.
        """
        owner, repo = host_repo_full_name.split("/", 1)
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            meta = await client.get(
                f"{self.api}/repos/{host_repo_full_name}", headers=self._headers()
            )
            meta.raise_for_status()
            branch = meta.json().get("default_branch", "main")

            committed: list[str] = []
            for name, content in files.items():
                path = f"{base_path}/{name}" if base_path else name
                if await self._put_file(client, owner, repo, path, content):
                    committed.append(path)

        folder = f"/tree/{branch}/{base_path}" if base_path else ""
        return {
            "html_url": f"https://github.com/{host_repo_full_name}{folder}",
            "repo_full_name": host_repo_full_name,
            "committed_files": committed,
            "branch": branch,
        }

    async def _put_file(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        path: str,
        content: str,
    ) -> bool:
        url = f"{self.api}/repos/{owner}/{repo}/contents/{path}"
        body: dict[str, Any] = {
            "message": f"opsmind: update {path}",
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
        }
        # If the file already exists we must pass its blob sha to update it.
        existing = await client.get(url, headers=self._headers())
        if existing.status_code == 200:
            body["sha"] = existing.json().get("sha")

        resp = await client.put(url, headers=self._headers(), json=body)
        return resp.status_code in (200, 201)
