from opsmindai.tools.startup.tool import MonitorStartupTool


async def monitor_startup() -> dict:
    return (await MonitorStartupTool().execute({"demo_mode": "healthy"})).data
