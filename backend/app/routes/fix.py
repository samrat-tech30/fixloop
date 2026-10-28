"""Fix mode routes: scenarios, start an agent run, poll a run, approve/reject a patch."""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app import db
from app.config import settings
from app.core import agent, sandbox
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
    _require_enabled()
    if db.active_fix_run():
        raise HTTPException(409, "Another fix run is still in progress")
    if not (sandbox.scenarios_dir() / body.scenario / "scenario.json").is_file():
        raise HTTPException(404, "Unknown scenario")
    run_id = db.create_run("fix", scenario=body.scenario)
    background.add_task(agent.run_agent, run_id, body.scenario, body.auto_approve or settings.auto_approve)
    return AgentRunResponse(run_id=run_id)


@router.get("/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: int) -> RunDetail:
    run = db.get_run(run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return RunDetail(
        id=run["id"], mode=run["mode"], scenario=run["scenario"], status=run["status"],
        attempts=run["attempts"], steps=db.list_steps(run_id), patches=db.list_patches(run_id),
        diagnoses=db.list_diagnoses(run_id), handoff_steps=run["handoff_steps"] or [])


@router.post("/patches/{patch_id}/decision", response_model=PatchDecisionResponse)
def decide(patch_id: int, body: PatchDecision) -> PatchDecisionResponse:
    _require_enabled()
    try:
        status = agent.decide_patch(patch_id, body.approve)
    except LookupError:
        raise HTTPException(404, "Patch not found") from None
    except ValueError:
        raise HTTPException(409, "Patch is not pending") from None
    return PatchDecisionResponse(status=status)
