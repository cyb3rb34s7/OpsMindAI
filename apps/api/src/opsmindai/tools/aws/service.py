from opsmindai.tools.aws.tool import ValidateAwsConfigTool


async def validate_aws_config() -> dict:
    return (await ValidateAwsConfigTool().execute({"demo_mode": "healthy"})).data
