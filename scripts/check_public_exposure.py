from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse


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

SOURCE_FILE_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".html",
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

ROUTE_EXPOSURE_PATTERNS = [
    re.compile(r"supported\s+routes", re.IGNORECASE),
    re.compile(r"unterst.{0,3}tzte\s+routen", re.IGNORECASE),
]

MANIFEST_ALLOWED_TOP_LEVEL_KEYS = {"schema_version", "services"}
MANIFEST_ALLOWED_SERVICE_KEYS = {
    "id",
    "label",
    "name",
    "detail_path",
    "status_path",
    "legacy_href",
    "note",
    "icon",
    "aliases",
    "category",
    "priority",
    "tags",
}
MANIFEST_FORBIDDEN_SERVICE_KEYS = {
    "builder",
    "state_path",
    "source",
    "config_source",
    "config_path",
    "data_dir",
    "scoring_profile",
}


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


def _normalize_host_token(value: object) -> str:
    text = str(value or "").strip().lower().lstrip(".")
    if not text:
        return ""
    if "://" in text or "/" in text:
        return ""
    return text


def _host_allowed(host: str, allowed_hosts: list[str]) -> bool:
    host_norm = _normalize_host_token(host)
    if not host_norm:
        return False
    for allowed in allowed_hosts:
        if host_norm == allowed or host_norm.endswith(f".{allowed}"):
            return True
    return False


def check_subscription_schema(errors: list[str]) -> None:
    path = SITE / "data" / "subscription.json"
    if not path.exists():
        return

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Could not parse site/data/subscription.json: {exc}")
        return

    if not isinstance(payload, dict):
        errors.append("site/data/subscription.json must contain a JSON object")
        return

    allowed_keys = {"provider", "form_url", "allowed_hosts"}
    extra = sorted(set(payload.keys()) - allowed_keys)
    if extra:
        errors.append(
            "site/data/subscription.json contains unexpected keys: " + ", ".join(extra)
        )

    form_url = str(payload.get("form_url") or "").strip()
    if not form_url:
        errors.append("site/data/subscription.json is missing form_url")
        return

    parsed = urlparse(form_url)
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        errors.append("site/data/subscription.json form_url must be an HTTPS URL")
        return

    form_host = _normalize_host_token(parsed.hostname)
    if not form_host:
        errors.append("site/data/subscription.json form_url host is invalid")
        return

    raw_allowed_hosts = payload.get("allowed_hosts")
    if not isinstance(raw_allowed_hosts, list) or not raw_allowed_hosts:
        errors.append("site/data/subscription.json allowed_hosts must be a non-empty list")
        return

    allowed_hosts: list[str] = []
    for value in raw_allowed_hosts:
        token = _normalize_host_token(value)
        if not token:
            errors.append("site/data/subscription.json allowed_hosts contains invalid host entries")
            continue
        if token not in allowed_hosts:
            allowed_hosts.append(token)

    if not allowed_hosts:
        errors.append("site/data/subscription.json allowed_hosts has no valid hosts")
        return

    if not _host_allowed(form_host, allowed_hosts):
        errors.append(
            "site/data/subscription.json form_url host is not allowed by allowed_hosts"
        )


def check_services_manifest_public_contract(errors: list[str]) -> None:
    path = SITE / "data" / "services-manifest.json"
    if not path.exists():
        return

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Could not parse site/data/services-manifest.json: {exc}")
        return

    if not isinstance(payload, dict):
        errors.append("site/data/services-manifest.json must contain a JSON object")
        return

    top_extra = sorted(set(payload.keys()) - MANIFEST_ALLOWED_TOP_LEVEL_KEYS)
    if top_extra:
        errors.append(
            "site/data/services-manifest.json contains unexpected top-level keys: "
            + ", ".join(top_extra)
        )

    services = payload.get("services")
    if not isinstance(services, list):
        errors.append("site/data/services-manifest.json services must be a list")
        return

    for index, service in enumerate(services):
        if not isinstance(service, dict):
            errors.append(f"site/data/services-manifest.json services[{index}] must be an object")
            continue

        forbidden = sorted(
            key for key in service.keys() if key in MANIFEST_FORBIDDEN_SERVICE_KEYS
        )
        if forbidden:
            errors.append(
                f"site/data/services-manifest.json services[{index}] contains forbidden keys: "
                + ", ".join(forbidden)
            )

        extra = sorted(set(service.keys()) - MANIFEST_ALLOWED_SERVICE_KEYS)
        if extra:
            errors.append(
                f"site/data/services-manifest.json services[{index}] contains unexpected keys: "
                + ", ".join(extra)
            )


def check_route_enumeration_exposure(errors: list[str]) -> None:
    scan_roots = [ROOT / "react-next" / "src", SITE]
    for scan_root in scan_roots:
        if not scan_root.exists():
            continue

        for path in scan_root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in SOURCE_FILE_SUFFIXES:
                continue
            rel = path.relative_to(ROOT).as_posix()
            if "/assets/" in rel or rel.startswith("site/vendor/"):
                continue

            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception as exc:
                errors.append(f"Could not read {rel}: {exc}")
                continue

            for pattern in ROUTE_EXPOSURE_PATTERNS:
                if pattern.search(text):
                    errors.append(
                        f"Potential public route enumeration marker in {rel}: {pattern.pattern}"
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
    check_services_manifest_public_contract(errors)
    check_route_enumeration_exposure(errors)
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
