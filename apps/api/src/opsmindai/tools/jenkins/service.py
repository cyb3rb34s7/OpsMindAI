from opsmindai.tools.jenkins.tool import TriggerDeploymentTool


async def trigger_deployment() -> dict:
    return (await TriggerDeploymentTool().execute({})).data
