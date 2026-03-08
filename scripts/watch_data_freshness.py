from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


DEFAULT_ENDPOINTS = [
    ("overwatch", "https://f1nn303.github.io/Owstatusupdater/data/status.json"),
    ("sony", "https://f1nn303.github.io/Owstatusupdater/sony/data/status.json"),
    ("m365", "https://f1nn303.github.io/Owstatusupdater/m365/data/status.json"),
    ("openai", "https://f1nn303.github.io/Owstatusupdater/openai/data/status.json"),
    ("claude", "https://f1nn303.github.io/Owstatusupdater/claude/data/status.json"),
    ("discord", "https://f1nn303.github.io/Owstatusupdater/discord/data/status.json"),
    ("slack", "https://f1nn303.github.io/Owstatusupdater/slack/data/status.json"),
    ("github", "https://f1nn303.github.io/Owstatusupdater/github/data/status.json"),
    ("cloudflare", "https://f1nn303.github.io/Owstatusupdater/cloudflare/data/status.json"),
    ("steam", "https://f1nn303.github.io/Owstatusupdater/steam/data/status.json"),
]
DEFAULT_REPO = "F1NN303/Owstatusupdater"
DEFAULT_WORKFLOW_ID = "update-site-data.yml"
DEFAULT_REF = "main"
DEFAULT_MAX_AGE_MINUTES = 75
DEFAULT_DISPATCH_COOLDOWN_MINUTES = 20
UA = "OW-Status-Freshness-Watchdog/1.0 (+github-actions)"


@dataclass
class EndpointStatus:
    name: str
    url: str
    generated_at: str | None
    age_minutes: int | None
    stale: bool
    error: str | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _request_json(url: str, token: str | None = None) -> dict[str, Any]:
    req = urllib.request.Request(url)
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return json.loads(resp.read().decode(charset))


def _request_no_content(url: str, payload: dict[str, Any], token: str) -> None:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        _ = resp.read()
        if resp.status not in (200, 201, 202, 204):
            raise RuntimeError(f"Unexpected status {resp.status} for {url}")


def check_endpoint(name: str, url: str, max_age_minutes: int) -> EndpointStatus:
    try:
        payload = _request_json(url)
    except urllib.error.HTTPError as exc:
        return EndpointStatus(
            name=name,
            url=url,
            generated_at=None,
            age_minutes=None,
            stale=True,
            error=f"HTTP {exc.code}",
        )
    except Exception as exc:  # pragma: no cover
        return EndpointStatus(
            name=name,
            url=url,
            generated_at=None,
            age_minutes=None,
            stale=True,
            error=str(exc),
        )

    generated_at = payload.get("generated_at")
    generated_dt = _parse_iso8601(generated_at)
    if generated_dt is None:
        return EndpointStatus(
            name=name,
            url=url,
            generated_at=str(generated_at) if generated_at is not None else None,
            age_minutes=None,
            stale=True,
            error="missing/invalid generated_at",
        )

    age_minutes = max(0, int((_utc_now() - generated_dt).total_seconds() // 60))
    return EndpointStatus(
        name=name,
        url=url,
        generated_at=str(generated_at),
        age_minutes=age_minutes,
        stale=age_minutes >= max_age_minutes,
    )


def get_workflow_runs(repo: str, workflow_id: str, token: str) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow_id}/runs?per_page=8"
    payload = _request_json(url, token=token)
    runs = payload.get("workflow_runs")
    return runs if isinstance(runs, list) else []


def _run_started_at(run: dict[str, Any]) -> dt.datetime | None:
    for key in ("run_started_at", "created_at", "updated_at"):
        parsed = _parse_iso8601(run.get(key))
        if parsed:
            return parsed
    return None


def should_dispatch(
    runs: list[dict[str, Any]],
    cooldown_minutes: int,
) -> tuple[bool, str]:
    active_statuses = {"queued", "in_progress", "waiting", "requested", "pending"}
    now = _utc_now()

    for run in runs:
        status = str(run.get("status") or "").lower()
        if status in active_statuses:
            return False, f"skip: update workflow already {status}"

    if runs:
        latest = runs[0]
        started = _run_started_at(latest)
        if started is not None:
            age = max(0, int((now - started).total_seconds() // 60))
            if age < cooldown_minutes:
                return False, f"skip: latest update run started {age}m ago (< {cooldown_minutes}m cooldown)"

    return True, "dispatch allowed"


def dispatch_workflow(repo: str, workflow_id: str, ref: str, token: str) -> None:
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow_id}/dispatches"
    _request_no_content(url, {"ref": ref}, token)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Watch deployed status payload freshness and trigger a recovery refresh if stale.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help=f"GitHub repo in owner/name form (default: {DEFAULT_REPO})")
    parser.add_argument("--workflow-id", default=DEFAULT_WORKFLOW_ID, help=f"Workflow file name or ID to dispatch (default: {DEFAULT_WORKFLOW_ID})")
    parser.add_argument("--ref", default=DEFAULT_REF, help=f"Git ref for workflow dispatch (default: {DEFAULT_REF})")
    parser.add_argument("--max-age-minutes", type=int, default=DEFAULT_MAX_AGE_MINUTES, help=f"Stale threshold for generated_at (default: {DEFAULT_MAX_AGE_MINUTES})")
    parser.add_argument("--cooldown-minutes", type=int, default=DEFAULT_DISPATCH_COOLDOWN_MINUTES, help=f"Min minutes between recovery dispatches (default: {DEFAULT_DISPATCH_COOLDOWN_MINUTES})")
    parser.add_argument("--dispatch-on-stale", action="store_true", help="Dispatch the update workflow when stale data is detected")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without dispatching")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    endpoint_results = [check_endpoint(name, url, args.max_age_minutes) for name, url in DEFAULT_ENDPOINTS]
    stale = [item for item in endpoint_results if item.stale]

    print(f"[freshness-watch] threshold={args.max_age_minutes}m")
    for item in endpoint_results:
        if item.error:
            print(f"[freshness-watch] {item.name}: STALE error={item.error} url={item.url}")
            continue
        print(
            f"[freshness-watch] {item.name}: generated_at={item.generated_at} age={item.age_minutes}m stale={item.stale}"
        )

    if not stale:
        print("[freshness-watch] OK: all monitored payloads are fresh.")
        return

    print(f"[freshness-watch] stale endpoints: {', '.join(item.name for item in stale)}")
    if not args.dispatch_on_stale:
        print("[freshness-watch] dispatch disabled; exiting.")
        return

    token_value = os.environ.get("GITHUB_TOKEN")

    if not token_value and not args.dry_run:
        raise SystemExit("[freshness-watch] ERROR: GITHUB_TOKEN is required for --dispatch-on-stale")

    if not token_value and args.dry_run:
        print("[freshness-watch] DRY RUN: skipping GitHub API checks (no GITHUB_TOKEN)")
        print(
            f"[freshness-watch] DRY RUN: would dispatch {args.workflow_id} on {args.repo}@{args.ref}"
        )
        return

    runs = get_workflow_runs(args.repo, args.workflow_id, token_value)
    allowed, reason = should_dispatch(runs, args.cooldown_minutes)
    print(f"[freshness-watch] {reason}")
    if not allowed:
        return

    if args.dry_run:
        print(
            f"[freshness-watch] DRY RUN: would dispatch {args.workflow_id} on {args.repo}@{args.ref}"
        )
        return

    dispatch_workflow(args.repo, args.workflow_id, args.ref, token_value)
    print(f"[freshness-watch] dispatched {args.workflow_id} on {args.repo}@{args.ref}")


if __name__ == "__main__":
    main()
