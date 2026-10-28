import json
from pathlib import Path

import pytest

from app.config import settings
from app.core import patterns
from app.core.preprocess import clean
from app.security import UnsafePathError, is_valid_npm_name, redact, safe_join

EXPECTED_BEST = {
    "npm-missing-module": "missing-npm-module",
    "crashloop": "k8s-crashloop",
    "imagepull": "k8s-imagepull",
    "oomkilled": "oom-killed",
    "port-in-use": "port-in-use",
    "db-refused": "db-connection-refused",
    "docker-copy": "docker-copy-failed",
    "eresolve": "npm-eresolve",
}


@pytest.mark.parametrize("name,pattern_id", EXPECTED_BEST.items())
def test_samples_match_expected_pattern(name, pattern_id):
    text = (settings.data_dir / "logs" / f"{name}.log").read_text(encoding="utf-8")
    hit = patterns.best(clean(text).text)
    assert hit is not None and hit.id == pattern_id


@pytest.mark.parametrize("line,pattern_id", [
    ("src/index.ts(1,19): error TS2307: Cannot find module 'axios' or its corresponding type declarations.",
     "missing-npm-module"),
    ("src/index.ts(1,30): error TS2307: Cannot find module './componets/header' or its corresponding type declarations.",
     "wrong-import-path"),
    ("src/config.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.", "typescript-type-error"),
    ("src/utils.ts(3,1): error TS1005: '}' expected.", "syntax-error"),
    ("Error: API_KEY is not defined. Set it in your hosting provider's environment variables.", "missing-env-var"),
    ("npm warn EBADENGINE Unsupported engine { required: { node: '>=22' } }", "node-version-mismatch"),
])
def test_demo_errors_match(line, pattern_id):
    assert patterns.best(line).id == pattern_id


def test_fix_steps_are_filled():
    hit = patterns.best("Module not found: Can't resolve 'razorpay'")
    assert "npm install razorpay" in hit.fix_steps[0]


def test_redaction():
    text, n = redact("DATABASE_URL=postgres://u:pw123456@db:5432/x token=abcdef123456 Bearer abcdefghijklmnop gsk_" + "a" * 30)
    assert "pw123456" not in text and "abcdef123456" not in text and "gsk_aaaa" not in text and n >= 3


def test_clean_keeps_errors_and_caps_length():
    raw = "\n".join(f"line {i}" for i in range(5000)) + "\nError: boom\n" + "\n".join(f"tail {i}" for i in range(50))
    c = clean(raw, max_chars=2000)
    assert "Error: boom" in c.text and len(c.text) <= 2100 and c.error_lines == ["Error: boom"]


def test_safe_join(tmp_path: Path):
    (tmp_path / "src").mkdir()
    assert safe_join(tmp_path, "src/a.ts") == (tmp_path / "src" / "a.ts").resolve()
    for bad in ["../x", "/etc/passwd", ".env", "src/.env.local", "node_modules/x/index.js", ".git/config", "a.pem"]:
        with pytest.raises(UnsafePathError):
            safe_join(tmp_path, bad)


def test_npm_names():
    assert is_valid_npm_name("axios") and is_valid_npm_name("@types/node")
    for bad in ["axios@1.0.0", "../evil", "https://x.y/z.tgz", "a b", "", "A" * 300]:
        assert not is_valid_npm_name(bad)


def test_patterns_json_valid():
    data = json.loads((settings.data_dir / "patterns.json").read_text(encoding="utf-8"))
    assert len({p["id"] for p in data}) == len(data) == 13
