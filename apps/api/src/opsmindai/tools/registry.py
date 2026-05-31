from opsmindai.tools.aws.tool import ValidateAwsConfigTool
from opsmindai.tools.github.tool import GitHubScannerTool
from opsmindai.tools.jenkins.tool import TriggerDeploymentTool
from opsmindai.tools.logs.tool import FetchLogsTool
from opsmindai.tools.sanity.tool import RunSanityChecksTool
from opsmindai.tools.startup.tool import MonitorStartupTool
from opsmindai.tools.traces.tool import CorrelateTraceTool

TOOL_REGISTRY: dict[str, object] = {}


def register_tool(name: str, tool: object) -> None:
    TOOL_REGISTRY[name] = tool


def get_tool(name: str):
    return TOOL_REGISTRY.get(name)


def list_tools() -> list[str]:
    return sorted(TOOL_REGISTRY.keys())


def register_default_tools() -> None:
    register_tool("scan_repository", GitHubScannerTool())
    register_tool("fetch_logs", FetchLogsTool())
    register_tool("correlate_trace", CorrelateTraceTool())
    register_tool("validate_aws_config", ValidateAwsConfigTool())
    register_tool("trigger_deployment", TriggerDeploymentTool())
    register_tool("monitor_startup", MonitorStartupTool())
    register_tool("run_sanity_checks", RunSanityChecksTool())
