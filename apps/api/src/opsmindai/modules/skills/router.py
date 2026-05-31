from fastapi import APIRouter

from opsmindai.modules.skills.repository import list_skills
from opsmindai.shared.responses import success_response

router = APIRouter(prefix="/api/v1", tags=["skills"])


@router.get("/skills/{customer_id}")
async def get_skills(customer_id: str):
    """Accumulated SRE playbook for a customer — the agent's learned memory."""
    return success_response({"customer_id": customer_id, "skills": list_skills(customer_id)})
