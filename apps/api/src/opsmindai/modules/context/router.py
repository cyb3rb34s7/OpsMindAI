from pathlib import Path

from fastapi import APIRouter

from opsmindai.shared.responses import success_response

router = APIRouter(prefix="/api/v1", tags=["context"])

CONTEXT_ROOT = Path("storage/context_repos")

# Preferred display order; anything else is appended alphabetically.
_ORDER = [
    "README.md",
    "project_index.md",
    "service_map.md",
    "data_flows.md",
    "tech_stack.md",
    "business_context.md",
    "risks.md",
    "decision_records.md",
    "open_questions.md",
]


@router.get("/context/{customer_id}")
async def get_context(customer_id: str):
    """Return the committed context-repo artifacts for in-app rendering."""
    repo_dir = CONTEXT_ROOT / customer_id
    if not repo_dir.exists():
        return success_response({"customer_id": customer_id, "exists": False, "files": []})

    found = {p.name: p for p in repo_dir.glob("*.md")}
    ordered = [n for n in _ORDER if n in found] + sorted(n for n in found if n not in _ORDER)
    files = [{"name": n, "content": found[n].read_text(encoding="utf-8")} for n in ordered]
    return success_response({"customer_id": customer_id, "exists": True, "files": files})
