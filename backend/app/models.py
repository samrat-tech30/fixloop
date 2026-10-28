"""Pydantic models. Must match docs/API.md and frontend/src/lib/types.ts."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.config import settings

Severity = Literal["critical", "warning", "info"]
RunStatus = Literal["running", "awaiting_approval", "diagnosed", "fixed", "handed_off", "failed"]


# ---------------------------------------------------------------- LLM output (validated)
class DiagnosisLLM(BaseModel):
    """Shape the LLM must return. Lenient on input, strict on output."""
    summary: str = Field(max_length=600)
    category: str = Field(default="unknown", max_length=40)
    root_cause: str = Field(max_length=1200)
    confidence: float = 0.5
    severity: Severity = "warning"
    evidence_lines: list[str] = Field(default_factory=list)
    fix_steps: list[str] = Field(default_factory=list)
    auto_fixable: bool = False
    files_to_change: list[str] = Field(default_factory=list)

    @field_validator("confidence", mode="before")
    @classmethod
    def _clamp(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5

    @field_validator("severity", mode="before")
    @classmethod
    def _sev(cls, v):
        v = str(v).lower().strip()
        return v if v in ("critical", "warning", "info") else "warning"

    @field_validator("category", mode="before")
    @classmethod
    def _cat(cls, v):
        return str(v or "unknown").lower().strip()[:40]

    @field_validator("evidence_lines", "fix_steps", "files_to_change", mode="before")
    @classmethod
    def _lists(cls, v):
        if isinstance(v, str):
            v = [v]
        return [str(x)[:400] for x in (v or [])][:8]

    @field_validator("summary", "root_cause", mode="before")
    @classmethod
    def _trim(cls, v):
        return str(v or "").strip()[:1200]


class Diagnosis(DiagnosisLLM):
    id: int | None = None
    pattern_id: str | None = None
    pattern_name: str | None = None
    provider: str
    model: str | None = None
    latency_ms: int | None = None
    redactions: int = 0


# ---------------------------------------------------------------- explain mode
class AnalyzeRequest(BaseModel):
    log: str = Field(min_length=1, max_length=settings.max_log_bytes)
    source: str | None = Field(default=None, max_length=50)


class AnalyzeResponse(BaseModel):
    run_id: int
    diagnosis: Diagnosis


class FeedbackRequest(BaseModel):
    run_id: int = Field(gt=0)
    diagnosis_id: int | None = Field(default=None, gt=0)
    rating: Literal[1, -1]
    comment: str | None = Field(default=None, max_length=500)


class OkResponse(BaseModel):
    ok: bool = True


class Stats(BaseModel):
    usefulness_pct: float | None
    ratings: int
    total_runs: int
    explain_runs: int
    fix_runs: int
    fixed: int
    handed_off: int
    failed: int
    auto_fix_rate_pct: float | None
    avg_latency_ms: int | None
    pattern_hit_pct: float | None


class PatternInfo(BaseModel):
    id: str
    name: str
    category: str
    severity: Severity
    auto_fixable: bool


class SampleInfo(BaseModel):
    name: str
    title: str


class Sample(SampleInfo):
    log: str


# ---------------------------------------------------------------- fix mode
class Scenario(BaseModel):
    id: str
    title: str
    expected: Literal["auto-fix", "hand-off"]
    description: str = ""


class AgentRunRequest(BaseModel):
    scenario: str = Field(pattern=r"^[a-z0-9\-]{1,40}$")
    auto_approve: bool = False


class AgentRunResponse(BaseModel):
    run_id: int


class Step(BaseModel):
    step_no: int
    action: str
    summary: str | None = None
    output_excerpt: str | None = None
    ok: bool
    created_at: str


class Patch(BaseModel):
    id: int
    kind: Literal["edit", "install"]
    file_path: str | None = None
    package: str | None = None
    diff: str
    status: str


class RunDetail(BaseModel):
    id: int
    mode: Literal["explain", "fix"]
    scenario: str | None = None
    status: RunStatus
    attempts: int
    steps: list[Step] = []
    patches: list[Patch] = []
    diagnoses: list[Diagnosis] = []
    handoff_steps: list[str] = []


class PatchDecision(BaseModel):
    approve: bool


class PatchDecisionResponse(BaseModel):
    status: Literal["approved", "rejected"]
