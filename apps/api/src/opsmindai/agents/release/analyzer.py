from __future__ import annotations

import json


def build_release_context(aws_validation: dict, startup_result: dict, sanity_results: list[str]) -> dict:
    return {
        "aws_validation": aws_validation,
        "startup_result": startup_result,
        "sanity_results": sanity_results,
        "evidence_summary": json.dumps(
            {
                "infra_findings": len(aws_validation.get("findings", [])),
                "sanity_checks": len(sanity_results),
            },
            indent=2,
        ),
    }
