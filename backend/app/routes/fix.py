"""Fix mode routes. /demo/scenarios works; the rest are STUBS — build with docs/PROMPTS.md prompt 7."""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.config import settings
from app.models import (AgentRunRequest, AgentRunResponse, PatchDecision, PatchDecisionResponse, RunDetail,
                        Scenario)
from app.security import require_api_key

router = APIRouter(dependencies=[Depends(require_api_key)])


def _require_enabled() -> None:
    if not settings.enable_fix_mode:
        raise HTTPException(403, "Fix mode is disabled on this server")


@router.get("/demo/scenarios", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    out = []
    for meta in sorted((settings.demo_dir / "scenarios").glob("*/scenario.json")):
        data = json.loads(meta.read_text(encoding="utf-8"))
        out.append(Scenario(id=meta.parent.name, **data))
    return out


@router.post("/agent/run", response_model=AgentRunResponse, status_code=202)
def start_agent(body: AgentRunRequest, background: BackgroundTasks) -> AgentRunResponse:
    """TODO (prompt 7): 409 if db.active_fix_run(); 404 if the scenario folder is missing;
    run_id = db.create_run('fix', scenario=...); background.add_task(agent.run_agent, run_id, scenario,
    body.auto_approve or settings.auto_approve); return {run_id}."""
    _require_enabled()
    raise HTTPException(501, "Fix mode not built yet")


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: int) -> RunDetail:
    """TODO (prompt 7): combine db.get_run, db.list_steps, db.list_patches, db.list_diagnoses.
    Works for explain runs too (no steps/patches)."""
    raise HTTPException(501, "Fix mode not built yet")


@router.post("/patches/{patch_id}/decision", response_model=PatchDecisionResponse)
def decide(patch_id: int, body: PatchDecision) -> PatchDecisionResponse:
    """TODO (prompt 7): agent.decide_patch(patch_id, body.approve); 404 unknown patch; 409 not pending."""
    _require_enabled()
    raise HTTPException(501, "Fix mode not built yet")
