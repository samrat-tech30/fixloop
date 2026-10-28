"""Show which patterns match each sample log. Usage (from backend/): python -m app.tools.check_patterns"""
import json

from app.config import settings
from app.core import patterns
from app.core.preprocess import clean


def main() -> None:
    logs_dir = settings.data_dir / "logs"
    used: set[str] = set()
    for s in json.loads((logs_dir / "samples.json").read_text(encoding="utf-8")):
        c = clean((logs_dir / f"{s['name']}.log").read_text(encoding="utf-8"))
        hits = patterns.match(c.text)
        used.update(h.id for h in hits)
        best = hits[0].id if hits else "NO MATCH"
        others = ", ".join(h.id for h in hits[1:])
        print(f"{s['name']:<22} best={best:<24} redactions={c.redactions:<2} others=[{others}]")
    unused = [p["id"] for p in patterns.load_patterns() if p["id"] not in used]
    print("\npatterns with no sample:", ", ".join(unused) or "none")


if __name__ == "__main__":
    main()
