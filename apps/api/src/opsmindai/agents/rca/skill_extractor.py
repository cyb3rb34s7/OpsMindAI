from opsmindai.agents.rca.schemas import RCAReport


def extract_skill(report: RCAReport) -> dict:
    return {
        "failure_pattern": report.root_cause,
        "resolution": report.recommendations[0] if report.recommendations else "investigate further",
        "success_score": report.confidence,
    }
