"""Run every sample log through diagnose() with the real LLM router.
Usage (from backend/): python -m app.tools.eval_samples [--offline]"""
import json
import sys

from app.config import settings
from app.core.diagnose import diagnose
from app.core.preprocess import clean


def main() -> None:
    offline = "--offline" in sys.argv
    logs_dir = settings.data_dir / "logs"
    samples = json.loads((logs_dir / "samples.json").read_text(encoding="utf-8"))
    latencies: list[int] = []
    for s in samples:
        c = clean((logs_dir / f"{s['name']}.log").read_text(encoding="utf-8"))
        d = diagnose(c, force_provider="ollama" if offline else None)
        latencies.append(d.latency_ms or 0)
        print(f"{s['name']:<20} pattern={str(d.pattern_id):<24} provider={d.provider:<8} "
              f"confidence={d.confidence:.2f} latency_ms={d.latency_ms:<6} fixable={d.auto_fixable!s:<5}")
        print(f"    summary: {d.summary}")
        for step in d.fix_steps:
            print(f"    - {step}")
    if latencies:
        print(f"\n{len(latencies)} samples, avg latency {sum(latencies) // len(latencies)} ms")


if __name__ == "__main__":
    main()
