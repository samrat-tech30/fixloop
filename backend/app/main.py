"""FastAPI entry point: `uvicorn app.main:app --reload --port 8000`."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import db
from app.config import settings
from app.core import llm, patterns
from app.limiter import limiter
from app.routes import explain, fix

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fixloop")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    db.seed_patterns(patterns.public_patterns())
    settings.runs_dir.mkdir(parents=True, exist_ok=True)
    log.info("FixLoop ready. LLM providers: %s. Auth: %s", llm.configured_providers() or "none",
             "on" if settings.app_api_key else "OFF (local dev)")
    yield


app = FastAPI(title="FixLoop API", version="0.1.0", lifespan=lifespan,
              description="Single-agent deployment troubleshooting assistant. See docs/API.md.")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "Internal error"})


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "providers": llm.configured_providers()}


app.include_router(explain.router)
app.include_router(fix.router)
