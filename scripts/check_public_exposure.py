from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

FORBIDDEN_SITE_GLOBS = [
    "**/state.json",
    "**/email_alert_state.json",
    "**/overwatch_state.json",
    "**/sony_state.json",
    "**/.env",
    "**/.env.*",
    "**/*.map",
]

TEXT_FILE_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".txt",
    ".md",
}

SECRET_PATTERNS = [
    re.compile(r"BREVO_API_KEY"),
    re.compile(r"ALERT_EMAIL_(FROM|TO)"),
    re.compile(r"GITHUB_TOKEN"),
    re.compile(r"github_pat_[A-Za-z0-9_]+"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
]


def iter_site_files():
    if not SITE.exists():
        return
    for path in SITE.rglob("*"):
        if path.is_file():
            yield path


def check_forbidden_site_files(errors: list[str]) -> None:
    for pattern in FORBIDDEN_SITE_GLOBS:
        for match in SITE.glob(pattern):
            if match.is_file():
                rel = match.relative_to(ROOT).as_posix()
                errors.append(f"Forbidden public file present: {rel}")


def check_tracked_bot_state(errors: list[str]) -> None:
    try:
        result = subprocess.run(
            ["git", "ls-files", ".bot_state"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception as exc:  # pragma: no cover - CI/runtime guard
        errors.append(f"Could not inspect tracked .bot_state files: {exc}")
        return

    tracked = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    for item in tracked:
        errors.append(f"Runtime state must not be tracked in public repo: {item}")


def check_subscription_schema(errors: list[str]) -> None:
    path = SITE / "data" / "subscription.json"
    if not path.exists():
        return

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Could not parse site/data/subscription.json: {exc}")
        return

    allowed_keys = {"provider", "form_url", "allowed_hosts"}
    extra = sorted(set(payload.keys()) - allowed_keys)
    if extra:
        errors.append(
            "site/data/subscription.json contains unexpected keys: " + ", ".join(extra)
        )


def check_secret_markers(errors: list[str]) -> None:
    for path in iter_site_files() or []:
        if path.suffix.lower() not in TEXT_FILE_SUFFIXES:
            continue
        rel = path.relative_to(ROOT).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            errors.append(f"Could not read {rel}: {exc}")
            continue

        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                errors.append(f"Potential secret marker in public file {rel}: {pattern.pattern}")


def main() -> int:
    errors: list[str] = []

    if not SITE.exists():
        print("warning: site directory not found, skipping public exposure checks", file=sys.stderr)
        return 0

    check_forbidden_site_files(errors)
    check_tracked_bot_state(errors)
    check_subscription_schema(errors)
    check_secret_markers(errors)

    if errors:
        print("Public exposure checks failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("Public exposure checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
