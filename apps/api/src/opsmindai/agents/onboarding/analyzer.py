from opsmindai.tools.github.schemas import RepositoryScanResult


def build_onboarding_context(scan_result: RepositoryScanResult) -> dict:
    return {
        "repo_name": scan_result.repo_name,
        "owner": scan_result.owner,
        "description": scan_result.description,
        "default_branch": scan_result.default_branch,
        "languages": scan_result.languages,
        "readme": scan_result.readme,
        "files": scan_result.files[:40],
        "detected_configs": scan_result.detected_configs[:25],
        "file_count": scan_result.file_count,
        "truncated": scan_result.truncated,
        "file_contents": scan_result.file_contents,
        "warnings": scan_result.warnings,
    }
