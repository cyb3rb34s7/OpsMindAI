from pathlib import Path

from opsmindai.agents.release.schemas import ReleaseReport

REPORT_ROOT = Path("storage/reports/releases")


class ReleaseReportWriter:
    def generate(self, deployment_id: str, report: ReleaseReport) -> str:
        report_dir = REPORT_ROOT / deployment_id
        report_dir.mkdir(parents=True, exist_ok=True)

        content = [
            f"# Release Report — {deployment_id}",
            "",
            f"## Status",
            report.deployment_status,
            "",
            "## Infra Warnings",
            *[f"- {x}" for x in report.infra_warnings],
            "",
            f"## Startup Health",
            report.startup_health,
            "",
            "## Sanity Results",
            *[f"- {x}" for x in report.sanity_results],
            "",
            f"## Rollback Recommended",
            str(report.rollback_recommended),
        ]
        (report_dir / "release_report.md").write_text("\n".join(content))
        return str(report_dir / "release_report.md")
