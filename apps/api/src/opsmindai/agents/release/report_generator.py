from pathlib import Path

from opsmindai.agents.release.schemas import ReleaseReport

REPORT_ROOT = Path("storage/reports/releases")


class ReleaseReportWriter:
    def generate(self, deployment_id: str, report: ReleaseReport) -> str:
        report_dir = REPORT_ROOT / deployment_id
        report_dir.mkdir(parents=True, exist_ok=True)

        lines = [
            f"# Release Report — {report.service} {report.version}",
            "",
            f"**Status:** {report.deployment_status}  |  "
            f"**Rollback recommended:** {report.rollback_recommended}",
            "",
            "## Changelog",
            *[f"- {c}" for c in report.changelog],
            "",
        ]
        if report.infra_warnings:
            lines += ["## Pre-deploy findings", *[f"- {w}" for w in report.infra_warnings], ""]

        lines += ["## Regions", "", "| Region | Status | Deployment | Startup | Sanity |", "|---|---|---|---|---|"]
        for r in report.regions:
            lines.append(
                f"| `{r.region}` | {r.status} | `{r.deployment_id}` | {r.startup_health} | "
                f"{'pass' if r.sanity_passed else 'fail'} |"
            )
        lines.append("")

        lines += ["## Release logs", ""]
        for r in report.regions:
            lines.append(f"### {r.region}")
            lines.append("```")
            lines += r.logs
            lines.append("```")
            lines.append("")

        (report_dir / "release_report.md").write_text("\n".join(lines), encoding="utf-8")
        return str(report_dir / "release_report.md")
