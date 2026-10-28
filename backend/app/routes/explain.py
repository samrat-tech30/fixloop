"""Explain mode routes (working)."""
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app import db
from app.config import settings
from app.core.diagnose import diagnose
from app.core.preprocess import clean
from app.limiter import limiter
from app.models import (AnalyzeRequest, AnalyzeResponse, FeedbackRequest, OkResponse, PatternInfo, Sample,
                        SampleInfo, Stats)
from app.security import require_api_key

router = APIRouter(dependencies=[Depends(require_api_key)])

_SAMPLE_NAME = re.compile(r"^[a-z0-9\-]{1,60}$")


@router.post("/analyze", response_model=AnalyzeResponse)
@limiter.limit(settings.rate_limit_analyze)
def analyze(request: Request, body: AnalyzeRequest,
            offline: bool = Query(False, description="Force the local Ollama model")) -> AnalyzeResponse:
    if len(body.log.encode("utf-8")) > settings.max_log_bytes:
        raise HTTPException(413, f"Log is larger than {settings.max_log_bytes} bytes")
    cleaned = clean(body.log)
    diag = diagnose(cleaned, force_provider="ollama" if offline else None)
    run_id = db.create_run("explain", source=body.source, log_chars=len(body.log), status="diagnosed")
    diag.id = db.save_diagnosis(run_id, diag.model_dump())
    db.update_run(run_id, duration_ms=diag.latency_ms)
    return AnalyzeResponse(run_id=run_id, diagnosis=diag)


@router.post("/feedback", response_model=OkResponse)
def feedback(body: FeedbackRequest) -> OkResponse:
    if not db.add_feedback(body.run_id, body.diagnosis_id, body.rating, body.comment):
        raise HTTPException(404, "Run or diagnosis not found")
    return OkResponse()


@router.get("/stats", response_model=Stats)
def stats() -> Stats:
    return Stats(**db.stats())


@router.get("/patterns", response_model=list[PatternInfo])
def list_patterns() -> list[PatternInfo]:
    return [PatternInfo(**p) for p in db.list_patterns()]


def _samples_index() -> list[dict]:
    return json.loads((settings.data_dir / "logs" / "samples.json").read_text(encoding="utf-8"))


@router.get("/samples", response_model=list[SampleInfo])
def list_samples() -> list[SampleInfo]:
    return [SampleInfo(**s) for s in _samples_index()]


@router.get("/samples/{name}", response_model=Sample)
def get_sample(name: str) -> Sample:
    entry = next((s for s in _samples_index() if s["name"] == name), None)
    if not _SAMPLE_NAME.match(name) or entry is None:
        raise HTTPException(404, "Sample not found")
    text = (settings.data_dir / "logs" / f"{name}.log").read_text(encoding="utf-8")
    return Sample(name=name, title=entry["title"], log=text)
