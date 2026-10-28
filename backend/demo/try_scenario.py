"""Manual check: build one scenario in a temp copy and print the output.

Usage (from backend/):  python demo/try_scenario.py missing-package
Run `cd demo/template && npm install` once first.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEMO = Path(__file__).resolve().parent


def main() -> int:
    if len(sys.argv) != 2:
        names = sorted(p.name for p in (DEMO / "scenarios").iterdir() if p.is_dir())
        print("usage: python demo/try_scenario.py <scenario>\nscenarios:", ", ".join(names))
        return 2
    scenario = DEMO / "scenarios" / sys.argv[1]
    if not scenario.is_dir():
        print("unknown scenario:", sys.argv[1])
        return 2
    npm = shutil.which("npm")
    if not npm:
        print("npm not found on PATH")
        return 2
    with tempfile.TemporaryDirectory() as tmp:
        sb = Path(tmp) / "app"
        shutil.copytree(DEMO / "template", sb, symlinks=True)  # keep node_modules/.bin links working
        for f in scenario.rglob("*"):
            if f.is_file() and f.name != "scenario.json":
                dest = sb / f.relative_to(scenario)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)
        if not (sb / "node_modules").exists():
            subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=sb, check=False)
        res = subprocess.run([npm, "run", "build"], cwd=sb, capture_output=True, text=True)
        print(res.stdout, res.stderr, f"\nexit code: {res.returncode}", sep="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
