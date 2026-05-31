from opsmindai.tools.sanity.tool import RunSanityChecksTool


async def run_sanity_checks() -> list[str]:
    result = await RunSanityChecksTool().execute({"demo_mode": "healthy"})
    return result.data.get("checks", [])
