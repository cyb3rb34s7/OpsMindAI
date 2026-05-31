from pathlib import Path

from opsmindai.agents.rca.schemas import RCAReport

REPORT_ROOT = Path("storage/reports")


class RCAReportWriter:
    def generate(self, incident_id: str, report: RCAReport) -> str:
        report_dir = REPORT_ROOT / incident_id
        report_dir.mkdir(parents=True, exist_ok=True)

        content = [
            f"# RCA Report — {incident_id}",
            "",
            f"## Root Cause",
            report.root_cause,
            "",
            f"## Confidence",
            str(report.confidence),
            "",
            "## Impacted Services",
            *[f"- {x}" for x in report.impacted_services],
            "",
            "## Trace Flow",
            *[f"- {x}" for x in report.trace_flow],
            "",
            "## Recommendations",
            *[f"- {x}" for x in report.recommendations],
        ]
        (report_dir / "rca_report.md").write_text("\n".join(content))
        return str(report_dir / "rca_report.md")
