import datetime as dt
import json
import os
import sys
from html import escape as html_escape
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.core.shared import _safe_http_url

STATUS_PATH = ROOT / "site" / "data" / "status.json"
STATE_PATH = ROOT / ".bot_state" / "email_alert_state.json"
DEFAULT_SITE_URL = "https://f1nn303.github.io/Owstatusupdater/"
DEFAULT_COOLDOWN_MINUTES = 360
BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _iso_utc(value: dt.datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=dt.UTC)
    return parsed.astimezone(dt.UTC)


def _read_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return dict(fallback)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return dict(fallback)
    return data if isinstance(data, dict) else dict(fallback)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_recipients(raw: str | None) -> list[str]:
    if not raw:
        return []
    tokens = str(raw).replace(";", ",").split(",")
    recipients = [token.strip() for token in tokens if token.strip()]
    # Keep deterministic ordering while removing duplicates.
    deduped: list[str] = []
    seen: set[str] = set()
    for email in recipients:
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(email)
    return deduped


def _escape_html(value: str | None) -> str:
    return html_escape(str(value or ""), quote=True)


def _build_email_payload(
    status: dict, site_url: str, sender_name: str, sender_email: str, recipients: list[str], force_send: bool
) -> dict:
    analytics = status.get("analytics") or {}
    outage = status.get("outage") or {}
    safe_site_url = _safe_http_url(site_url) or DEFAULT_SITE_URL
    generated_at = str(status.get("generated_at") or _iso_utc(_now()))
    severity = str(analytics.get("severity_key") or "unknown")
    reports_24h = int(outage.get("reports_24h") or 0)
    source_ok = int(analytics.get("source_ok_count") or 0)
    source_total = int(analytics.get("source_total_count") or 0)
    summary = str(outage.get("summary") or "No summary available.")
    source_url = _safe_http_url(outage.get("url")) or safe_site_url

    if force_send:
        subject = f"[Overwatch Radar] Test alert - {generated_at}"
        intro = "Overwatch Radar test email. This confirms Brevo delivery is configured."
    else:
        subject = f"[Overwatch Radar] Major outage detected - {generated_at}"
        intro = "Overwatch Radar detected a major outage condition."

    text = "\n".join(
        [
            intro,
            "",
            f"Generated at: {generated_at}",
            f"Severity: {severity}",
            f"Reports (24h): {reports_24h}",
            f"Source agreement: {source_ok}/{source_total}",
            f"Outage summary: {summary}",
            "",
            f"Dashboard: {safe_site_url}",
            f"Outage source: {source_url}",
        ]
    )
    html = (
        f"<h2>Overwatch Radar: {'Test alert' if force_send else 'Major outage detected'}</h2>"
        f"<p><strong>Generated at:</strong> {_escape_html(generated_at)}<br>"
        f"<strong>Severity:</strong> {_escape_html(severity)}<br>"
        f"<strong>Reports (24h):</strong> {reports_24h}<br>"
        f"<strong>Source agreement:</strong> {source_ok}/{source_total}</p>"
        f"<p>{_escape_html(summary)}</p>"
        f"<p><a href=\"{_escape_html(safe_site_url)}\">Open dashboard</a><br>"
        f"<a href=\"{_escape_html(source_url)}\">Open outage source</a></p>"
    )

    return {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email} for email in recipients],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
        "tags": ["overwatch-radar", "major-outage"],
    }


def _send_via_brevo(api_key: str, payload: dict) -> tuple[bool, str]:
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key,
    }
    try:
        response = requests.post(BREVO_ENDPOINT, headers=headers, json=payload, timeout=25)
    except requests.RequestException:
        return False, "request_error"
    if response.status_code not in {200, 201, 202}:
        # Keep error reason generic so no remote response payload is persisted.
        return False, f"http_{response.status_code}"
    try:
        data = response.json()
    except Exception:
        data = {}
    message_id = str(data.get("messageId") or data.get("message_id") or "accepted")
    return True, message_id


def main() -> None:
    now = _now()
    status = _read_json(STATUS_PATH, {})
    state = _read_json(
        STATE_PATH,
        {
            "updated_at": None,
            "last_seen_severity": "unknown",
            "last_seen_status_generated_at": None,
            "last_major_email_at": None,
            "last_major_status_generated_at": None,
            "last_email_result": "never",
            "last_email_reason": "not_evaluated",
        },
    )
    # Drop legacy field so relay metadata is not retained in repository state.
    state.pop("last_message_id", None)

    severity = str((status.get("analytics") or {}).get("severity_key") or "unknown")
    generated_at = str(status.get("generated_at") or "")
    cooldown_minutes = int(os.getenv("ALERT_MAJOR_COOLDOWN_MINUTES", str(DEFAULT_COOLDOWN_MINUTES)))
    force_send = os.getenv("ALERT_FORCE_SEND", "").strip().lower() in {"1", "true", "yes", "on"}

    sender_email = os.getenv("ALERT_EMAIL_FROM", "").strip()
    sender_name = os.getenv("ALERT_EMAIL_SENDER_NAME", "Overwatch Service Radar").strip() or "Overwatch Service Radar"
    recipients = _parse_recipients(os.getenv("ALERT_EMAIL_TO"))
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    site_url = _safe_http_url(os.getenv("ALERT_SITE_URL", DEFAULT_SITE_URL).strip()) or DEFAULT_SITE_URL

    previous_severity = str(state.get("last_seen_severity") or "unknown")
    just_entered_major = previous_severity != "major" and severity == "major"
    cooldown_elapsed = True
    last_major_email_at = _parse_iso(state.get("last_major_email_at"))
    if last_major_email_at:
        cooldown_elapsed = (now - last_major_email_at) >= dt.timedelta(minutes=max(cooldown_minutes, 1))
    new_major_snapshot = generated_at and generated_at != str(state.get("last_major_status_generated_at") or "")
    should_send = force_send or (severity == "major" and new_major_snapshot and (just_entered_major or cooldown_elapsed))

    state["updated_at"] = _iso_utc(now)
    state["last_seen_severity"] = severity
    state["last_seen_status_generated_at"] = generated_at or state.get("last_seen_status_generated_at")

    if not should_send:
        reason = "not_major"
        if severity == "major" and not force_send:
            if not new_major_snapshot:
                reason = "duplicate_snapshot"
            elif not just_entered_major and not cooldown_elapsed:
                reason = "cooldown_active"
        state["last_email_result"] = "skipped"
        state["last_email_reason"] = reason
        _write_json(STATE_PATH, state)
        print(f"[brevo] skip send ({reason}) severity={severity}")
        return

    if not api_key or not sender_email or not recipients:
        state["last_email_result"] = "skipped"
        state["last_email_reason"] = "missing_config"
        _write_json(STATE_PATH, state)
        print("[brevo] skip send (missing_config). Set BREVO_API_KEY, ALERT_EMAIL_FROM, ALERT_EMAIL_TO.")
        return

    payload = _build_email_payload(status, site_url, sender_name, sender_email, recipients, force_send)
    ok, message = _send_via_brevo(api_key, payload)
    if ok:
        state["last_major_email_at"] = _iso_utc(now)
        state["last_major_status_generated_at"] = generated_at
        state["last_email_result"] = "sent"
        state["last_email_reason"] = "forced_test" if force_send else "major_outage"
        _write_json(STATE_PATH, state)
        print(f"[brevo] email sent message_id={message} recipients={len(recipients)}")
        return

    state["last_email_result"] = "error"
    state["last_email_reason"] = message
    _write_json(STATE_PATH, state)
    print(f"[brevo] send failed: {message}")


if __name__ == "__main__":
    main()
