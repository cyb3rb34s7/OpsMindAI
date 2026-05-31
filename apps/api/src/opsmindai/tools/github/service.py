from opsmindai.tools.github.tool import GitHubScannerTool


class GitHubScannerService:
    async def scan_repository(self, repo_url: str):
        return (await GitHubScannerTool().execute({"repo_url": repo_url})).data
