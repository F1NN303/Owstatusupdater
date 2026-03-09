import datetime as dt
import hashlib
import json
import os
import sys
from html import escape as html_escape
from pathlib import Path
from urllib.parse import urljoin

import requests

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.build_site_data import DEFAULT_SERVICE_PREFERRED, SERVICE_CONFIGS
from services.core.shared import _safe_http_url

STATE_PATH = ROOT / ".bot_state" / "email_alert_state.json"
DEFAULT_SITE_URL = "https://f1nn303.github.io/Owstatusupdater/"
DEFAULT_COOLDOWN_MINUTES = 360
BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
SUPABASE_TIMEOUT_SECONDS = 25
ALERTABLE_SEVERITIES = {"degraded", "major"}
SEVERITY_RANK = {
    "stable": 0,
    "minor": 1,
    "degraded": 2,
    "major": 3,
    "unknown": -1,
}


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


def _escape_html(value: str | None) -> str:
    return html_escape(str(value or ""), quote=True)


def _parse_recipients(raw: str | None) -> list[str]:
    if not raw:
        return []
    tokens = str(raw).replace(";", ",").split(",")
    recipients = [token.strip() for token in tokens if token.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for email in recipients:
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(email)
    return deduped


def _parse_cooldown_minutes(raw: str | None) -> int:
    try:
        parsed = int(str(raw or "").strip())
    except (TypeError, ValueError):
        return DEFAULT_COOLDOWN_MINUTES
    return max(parsed, 1)


def _normalize_service_id(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return ""
    return "".join(ch for ch in normalized if ch.isalnum() or ch in {"-", "_"})[:64]


def _normalize_service_ids(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        normalized = _normalize_service_id(item)
        if not normalized or normalized in out:
            continue
        out.append(normalized)
    return out


def _normalize_threshold(value: object) -> str:
    lowered = str(value or "").strip().lower()
    return "degraded" if lowered == "degraded" else "major"


def _normalize_severity(value: object) -> str:
    lowered = str(value or "").strip().lower()
    if lowered in SEVERITY_RANK:
        return lowered
    return "unknown"


def _severity_matches_threshold(severity: str, threshold: str) -> bool:
    normalized_severity = _normalize_severity(severity)
    normalized_threshold = _normalize_threshold(threshold)
    if normalized_threshold == "major":
        return normalized_severity == "major"
    return normalized_severity in ALERTABLE_SEVERITIES


def _join_site_url(base_url: str, path: str) -> str:
    safe_base = _safe_http_url(base_url) or DEFAULT_SITE_URL
    normalized_base = safe_base if safe_base.endswith("/") else f"{safe_base}/"
    relative = str(path or "").strip()
    if relative.startswith("/"):
        relative = relative[1:]
    return _safe_http_url(urljoin(normalized_base, relative)) or safe_base


def _service_sort_key(item: tuple[str, dict]) -> tuple[int, str]:
    service_id, config = item
    try:
        priority = int(str(config.get("home_order") or "9999").strip())
    except Exception:
        priority = 9999
    return priority, service_id


def _service_status_path(config: dict) -> Path:
    data_dir = Path(str(config.get("data_dir") or "").strip())
    if not data_dir:
        return ROOT / "site" / "data" / "status.json"
    return ROOT / data_dir / "status.json"


def _build_service_entries(site_root_url: str) -> dict[str, dict]:
    entries: dict[str, dict] = {}
    for service_id, config in sorted(SERVICE_CONFIGS.items(), key=_service_sort_key):
        status_path = _service_status_path(config)
        status = _read_json(status_path, {})
        if not status:
            continue
        detail_path = str(config.get("detail_path") or f"/status/{service_id}").strip() or f"/status/{service_id}"
        detail_url = _join_site_url(site_root_url, detail_path)
        service_url = _safe_http_url(config.get("site_url")) or detail_url
        entries[service_id] = {
            "service_id": service_id,
            "label": str(config.get("label") or service_id),
            "display_name": str(config.get("display_name") or config.get("label") or service_id),
            "detail_path": detail_path,
            "detail_url": detail_url,
            "service_url": service_url,
            "status_path": status_path,
            "status": status,
        }
    return entries


def _subscriber_key(record: dict) -> str:
    user_id = str(record.get("user_id") or "").strip()
    if user_id:
        return user_id
    digest = hashlib.sha256(str(record.get("email") or "").strip().lower().encode("utf-8")).hexdigest()
    return digest[:24]


def _state_bucket(state: dict, subscriber_key: str, service_id: str) -> dict:
    subscribers = state.setdefault("subscriber_alerts", {})
    subscriber_state = subscribers.setdefault(subscriber_key, {})
    return subscriber_state.setdefault(
        service_id,
        {
            "last_sent_at": None,
            "last_sent_status_generated_at": None,
            "last_sent_severity": "unknown",
            "last_email_result": "never",
            "last_email_reason": "not_evaluated",
        },
    )


def _legacy_state_bucket(state: dict) -> dict:
    legacy = state.setdefault(
        "legacy_recipient_alert",
        {
            "last_sent_at": state.get("last_major_email_at"),
            "last_sent_status_generated_at": state.get("last_major_status_generated_at"),
            "last_sent_severity": state.get("last_seen_severity", "unknown"),
            "last_email_result": state.get("last_email_result", "never"),
            "last_email_reason": state.get("last_email_reason", "not_evaluated"),
        },
    )
    return legacy


def _should_send_service_alert(
    status: dict,
    state_entry: dict,
    now: dt.datetime,
    cooldown_minutes: int,
    force_send: bool,
    threshold: str,
) -> tuple[bool, str]:
    severity = _normalize_severity((status.get("analytics") or {}).get("severity_key"))
    generated_at = str(status.get("generated_at") or "")

    if force_send:
        return True, "force_send"
    if not _severity_matches_threshold(severity, threshold):
        return False, "below_threshold"
    if not generated_at:
        return False, "missing_generated_at"

    last_snapshot = str(state_entry.get("last_sent_status_generated_at") or "")
    if generated_at == last_snapshot:
        return False, "duplicate_snapshot"

    previous_severity = _normalize_severity(state_entry.get("last_sent_severity"))
    if previous_severity != severity:
        return True, "severity_change"

    last_sent_at = _parse_iso(state_entry.get("last_sent_at"))
    if last_sent_at and (now - last_sent_at) < dt.timedelta(minutes=max(cooldown_minutes, 1)):
        return False, "cooldown_active"

    return True, "cooldown_elapsed"


def _build_email_payload(
    service_entry: dict,
    status: dict,
    sender_name: str,
    sender_email: str,
    recipient_email: str,
    force_send: bool,
) -> dict:
    analytics = status.get("analytics") or {}
    outage = status.get("outage") or {}
    generated_at = str(status.get("generated_at") or _iso_utc(_now()))
    severity = _normalize_severity(analytics.get("severity_key"))
    reports_24h = int(outage.get("reports_24h") or 0)
    source_ok = int(analytics.get("source_ok_count") or 0)
    source_total = int(analytics.get("source_total_count") or 0)
    summary = str(
        outage.get("summary")
        or (status.get("official") or {}).get("summary")
        or "No summary available."
    )
    detail_url = _safe_http_url(service_entry.get("detail_url")) or DEFAULT_SITE_URL
    source_url = _safe_http_url(outage.get("url")) or detail_url
    service_name = str(service_entry.get("display_name") or service_entry.get("label") or service_entry.get("service_id") or "Service")
    severity_label = severity.upper()

    if force_send:
        subject = f"[StatusChecker] Test alert - {service_name} - {generated_at}"
        intro = f"StatusChecker test email for {service_name}."
    else:
        subject = f"[StatusChecker] {service_name} {severity_label} alert - {generated_at}"
        intro = f"StatusChecker detected a {severity} service state for {service_name}."

    text = "\n".join(
        [
            intro,
            "",
            f"Service: {service_name}",
            f"Generated at: {generated_at}",
            f"Severity: {severity}",
            f"Reports (24h): {reports_24h}",
            f"Source agreement: {source_ok}/{source_total}",
            f"Summary: {summary}",
            "",
            f"Service detail: {detail_url}",
            f"Outage source: {source_url}",
        ]
    )
    html = (
        f"<h2>{_escape_html(service_name)}: {'Test alert' if force_send else f'{_escape_html(severity_label)} alert'}</h2>"
        f"<p><strong>Generated at:</strong> {_escape_html(generated_at)}<br>"
        f"<strong>Severity:</strong> {_escape_html(severity)}<br>"
        f"<strong>Reports (24h):</strong> {reports_24h}<br>"
        f"<strong>Source agreement:</strong> {source_ok}/{source_total}</p>"
        f"<p>{_escape_html(summary)}</p>"
        f"<p><a href=\"{_escape_html(detail_url)}\">Open service detail</a><br>"
        f"<a href=\"{_escape_html(source_url)}\">Open outage source</a></p>"
    )

    return {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": recipient_email}],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
        "tags": ["statuschecker", str(service_entry.get("service_id") or "service"), f"severity-{severity}"],
    }


def _send_via_brevo(api_key: str, payload: dict) -> tuple[bool, str]:
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key,
    }
    try:
        response = requests.post(BREVO_ENDPOINT, headers=headers, json=payload, timeout=SUPABASE_TIMEOUT_SECONDS)
    except requests.RequestException:
        return False, "request_error"
    if response.status_code not in {200, 201, 202}:
        return False, f"http_{response.status_code}"
    try:
        data = response.json()
    except Exception:
        data = {}
    message_id = str(data.get("messageId") or data.get("message_id") or "accepted")
    return True, message_id


def _normalize_supabase_url(raw: str | None) -> str:
    value = _safe_http_url(raw)
    if not value:
        return ""
    return value.rstrip("/")


def _supabase_headers(api_key: str, prefer_return: bool = False) -> dict[str, str]:
    headers = {
        "accept": "application/json",
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
    }
    if prefer_return:
        headers["Prefer"] = "return=minimal"
    return headers


def _fetch_supabase_rows(base_url: str, api_key: str, table: str, params: dict[str, str]) -> list[dict]:
    url = f"{base_url}/rest/v1/{table}"
    try:
        response = requests.get(url, headers=_supabase_headers(api_key), params=params, timeout=SUPABASE_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise RuntimeError(f"request_error:{table}") from exc
    if response.status_code != 200:
        raise RuntimeError(f"http_{response.status_code}:{table}")
    try:
        payload = response.json()
    except Exception as exc:
        raise RuntimeError(f"invalid_json:{table}") from exc
    if not isinstance(payload, list):
        raise RuntimeError(f"unexpected_payload:{table}")
    return [item for item in payload if isinstance(item, dict)]


def _patch_profile(base_url: str, api_key: str, user_id: str, payload: dict) -> bool:
    if not user_id:
        return False
    url = f"{base_url}/rest/v1/profiles"
    try:
        response = requests.patch(
            url,
            headers=_supabase_headers(api_key, prefer_return=True),
            params={"user_id": f"eq.{user_id}"},
            json=payload,
            timeout=SUPABASE_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        return False
    return response.status_code in {200, 204}


def _fetch_subscribers(base_url: str, api_key: str) -> list[dict]:
    profile_rows = _fetch_supabase_rows(
        base_url,
        api_key,
        "profiles",
        {
            "select": "user_id,email,connection_status,brevo_sync_status,provider_contact_id,last_synced_at,last_delivery_at",
            "connection_status": "eq.active",
        },
    )
    preference_rows = _fetch_supabase_rows(
        base_url,
        api_key,
        "alert_preferences",
        {
            "select": "user_id,alerts_enabled,severity_threshold,watched_service_ids,favorite_sync_enabled,updated_at",
        },
    )

    preference_map: dict[str, dict] = {}
    for record in preference_rows:
        user_id = str(record.get("user_id") or "").strip()
        if not user_id:
            continue
        preference_map[user_id] = {
            "alerts_enabled": bool(record.get("alerts_enabled", True)),
            "severity_threshold": _normalize_threshold(record.get("severity_threshold")),
            "watched_service_ids": _normalize_service_ids(record.get("watched_service_ids")),
            "favorite_sync_enabled": bool(record.get("favorite_sync_enabled", False)),
            "updated_at": str(record.get("updated_at") or "").strip() or None,
        }

    subscribers: list[dict] = []
    for record in profile_rows:
        user_id = str(record.get("user_id") or "").strip()
        email = str(record.get("email") or "").strip().lower()
        if not user_id or not email or "@" not in email:
            continue
        preferences = preference_map.get(
            user_id,
            {
                "alerts_enabled": True,
                "severity_threshold": "major",
                "watched_service_ids": [],
                "favorite_sync_enabled": False,
                "updated_at": None,
            },
        )
        subscribers.append(
            {
                "user_id": user_id,
                "email": email,
                "connection_status": str(record.get("connection_status") or "active"),
                "brevo_sync_status": str(record.get("brevo_sync_status") or "not_synced"),
                "provider_contact_id": str(record.get("provider_contact_id") or "").strip() or None,
                "last_synced_at": str(record.get("last_synced_at") or "").strip() or None,
                "last_delivery_at": str(record.get("last_delivery_at") or "").strip() or None,
                **preferences,
            }
        )
    return subscribers


def _sync_active_profiles(base_url: str, api_key: str, subscribers: list[dict], timestamp: str) -> None:
    for subscriber in subscribers:
        _patch_profile(
            base_url,
            api_key,
            subscriber["user_id"],
            {
                "brevo_sync_status": "synced",
                "last_synced_at": timestamp,
            },
        )


def _dispatch_to_subscribers(
    api_key: str,
    sender_name: str,
    sender_email: str,
    site_root_url: str,
    supabase_url: str,
    supabase_api_key: str,
    force_send: bool,
    cooldown_minutes: int,
    state: dict,
    now: dt.datetime,
) -> tuple[int, int]:
    service_entries = _build_service_entries(site_root_url)
    subscribers = _fetch_subscribers(supabase_url, supabase_api_key)
    _sync_active_profiles(supabase_url, supabase_api_key, subscribers, _iso_utc(now))

    sent_count = 0
    attempted_count = 0
    for subscriber in subscribers:
        if not subscriber.get("alerts_enabled", True):
            continue
        watched_service_ids = _normalize_service_ids(subscriber.get("watched_service_ids"))
        if not watched_service_ids:
            continue

        subscriber_key = _subscriber_key(subscriber)
        threshold = _normalize_threshold(subscriber.get("severity_threshold"))
        for service_id in watched_service_ids:
            service_entry = service_entries.get(service_id)
            if not service_entry:
                continue

            status = service_entry["status"]
            state_entry = _state_bucket(state, subscriber_key, service_id)
            should_send, reason = _should_send_service_alert(
                status,
                state_entry,
                now,
                cooldown_minutes,
                force_send,
                threshold,
            )
            if not should_send:
                state_entry["last_email_result"] = "skipped"
                state_entry["last_email_reason"] = reason
                continue

            attempted_count += 1
            payload = _build_email_payload(
                service_entry,
                status,
                sender_name,
                sender_email,
                subscriber["email"],
                force_send,
            )
            ok, message = _send_via_brevo(api_key, payload)
            if ok:
                sent_count += 1
                state_entry["last_sent_at"] = _iso_utc(now)
                state_entry["last_sent_status_generated_at"] = str(status.get("generated_at") or "")
                state_entry["last_sent_severity"] = _normalize_severity(
                    (status.get("analytics") or {}).get("severity_key")
                )
                state_entry["last_email_result"] = "sent"
                state_entry["last_email_reason"] = "forced_test" if force_send else "service_alert"
                _patch_profile(
                    supabase_url,
                    supabase_api_key,
                    subscriber["user_id"],
                    {
                        "brevo_sync_status": "synced",
                        "last_synced_at": _iso_utc(now),
                        "last_delivery_at": _iso_utc(now),
                    },
                )
                continue

            state_entry["last_email_result"] = "error"
            state_entry["last_email_reason"] = message
            _patch_profile(
                supabase_url,
                supabase_api_key,
                subscriber["user_id"],
                {
                    "brevo_sync_status": "error",
                    "last_synced_at": _iso_utc(now),
                },
            )

    return sent_count, attempted_count


def _select_default_service_entry(service_entries: dict[str, dict], explicit_service_id: str | None = None) -> dict | None:
    if explicit_service_id:
        normalized = _normalize_service_id(explicit_service_id)
        if normalized and normalized in service_entries:
            return service_entries[normalized]
    if DEFAULT_SERVICE_PREFERRED in service_entries:
        return service_entries[DEFAULT_SERVICE_PREFERRED]
    if not service_entries:
        return None
    first_key = sorted(service_entries.keys())[0]
    return service_entries[first_key]


def _dispatch_legacy_recipients(
    api_key: str,
    sender_name: str,
    sender_email: str,
    recipients: list[str],
    site_root_url: str,
    service_id: str | None,
    force_send: bool,
    cooldown_minutes: int,
    state: dict,
    now: dt.datetime,
) -> tuple[int, int]:
    service_entries = _build_service_entries(site_root_url)
    service_entry = _select_default_service_entry(service_entries, service_id)
    if not service_entry:
        return 0, 0

    legacy_state = _legacy_state_bucket(state)
    should_send, reason = _should_send_service_alert(
        service_entry["status"],
        legacy_state,
        now,
        cooldown_minutes,
        force_send,
        "major",
    )
    if not should_send:
        legacy_state["last_email_result"] = "skipped"
        legacy_state["last_email_reason"] = reason
        return 0, 0

    sent_count = 0
    for recipient in recipients:
        payload = _build_email_payload(
            service_entry,
            service_entry["status"],
            sender_name,
            sender_email,
            recipient,
            force_send,
        )
        ok, message = _send_via_brevo(api_key, payload)
        if ok:
            sent_count += 1
            continue
        legacy_state["last_email_result"] = "error"
        legacy_state["last_email_reason"] = message
        return sent_count, len(recipients)

    legacy_state["last_sent_at"] = _iso_utc(now)
    legacy_state["last_sent_status_generated_at"] = str(service_entry["status"].get("generated_at") or "")
    legacy_state["last_sent_severity"] = _normalize_severity(
        (service_entry["status"].get("analytics") or {}).get("severity_key")
    )
    legacy_state["last_email_result"] = "sent"
    legacy_state["last_email_reason"] = "forced_test" if force_send else "legacy_global_alert"
    return sent_count, len(recipients)


def main() -> None:
    now = _now()
    state = _read_json(
        STATE_PATH,
        {
            "schema_version": 2,
            "updated_at": None,
            "subscriber_alerts": {},
            "legacy_recipient_alert": {
                "last_sent_at": None,
                "last_sent_status_generated_at": None,
                "last_sent_severity": "unknown",
                "last_email_result": "never",
                "last_email_reason": "not_evaluated",
            },
            "last_run": {
                "mode": "never",
                "result": "never",
                "reason": "not_evaluated",
                "sent_count": 0,
                "attempted_count": 0,
            },
        },
    )
    state.pop("last_message_id", None)
    state["schema_version"] = 2
    state["updated_at"] = _iso_utc(now)

    cooldown_minutes = _parse_cooldown_minutes(os.getenv("ALERT_MAJOR_COOLDOWN_MINUTES"))
    force_send = os.getenv("ALERT_FORCE_SEND", "").strip().lower() in {"1", "true", "yes", "on"}

    sender_email = os.getenv("ALERT_EMAIL_FROM", "").strip()
    sender_name = os.getenv("ALERT_EMAIL_SENDER_NAME", "StatusChecker Alerts").strip() or "StatusChecker Alerts"
    explicit_recipients = _parse_recipients(os.getenv("ALERT_EMAIL_TO"))
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    site_root_url = _safe_http_url(os.getenv("ALERT_SITE_URL", DEFAULT_SITE_URL).strip()) or DEFAULT_SITE_URL
    test_service_id = os.getenv("ALERT_TEST_SERVICE_ID", "").strip() or None
    supabase_url = _normalize_supabase_url(
        os.getenv("ALERT_SUPABASE_URL")
        or os.getenv("SUPABASE_URL")
        or os.getenv("VITE_SUPABASE_URL")
    )
    supabase_api_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_SECRET_KEY", "").strip()
    )

    if not api_key or not sender_email:
        state["last_run"] = {
            "mode": "none",
            "result": "skipped",
            "reason": "missing_brevo_config",
            "sent_count": 0,
            "attempted_count": 0,
        }
        _write_json(STATE_PATH, state)
        print("[brevo] skip send (missing_brevo_config). Set BREVO_API_KEY and ALERT_EMAIL_FROM.")
        return

    sent_count = 0
    attempted_count = 0
    run_mode = "none"
    reason = "no_dispatch_target"

    try:
        if force_send and explicit_recipients:
            run_mode = "forced_test"
            sent_count, attempted_count = _dispatch_legacy_recipients(
                api_key,
                sender_name,
                sender_email,
                explicit_recipients,
                site_root_url,
                test_service_id,
                True,
                cooldown_minutes,
                state,
                now,
            )
            reason = "forced_test"
        elif supabase_url and supabase_api_key:
            run_mode = "subscriber_dispatch"
            sent_count, attempted_count = _dispatch_to_subscribers(
                api_key,
                sender_name,
                sender_email,
                site_root_url,
                supabase_url,
                supabase_api_key,
                False,
                cooldown_minutes,
                state,
                now,
            )
            reason = "subscriber_dispatch"
        elif explicit_recipients:
            run_mode = "legacy_recipients"
            sent_count, attempted_count = _dispatch_legacy_recipients(
                api_key,
                sender_name,
                sender_email,
                explicit_recipients,
                site_root_url,
                DEFAULT_SERVICE_PREFERRED,
                False,
                cooldown_minutes,
                state,
                now,
            )
            reason = "legacy_recipients"
        else:
            run_mode = "none"
            reason = "missing_supabase_and_legacy_recipients"
    except RuntimeError as exc:
        state["last_run"] = {
            "mode": run_mode or "subscriber_dispatch",
            "result": "error",
            "reason": str(exc),
            "sent_count": sent_count,
            "attempted_count": attempted_count,
        }
        _write_json(STATE_PATH, state)
        print(f"[brevo] send failed: {exc}")
        return

    result = "sent" if sent_count > 0 else "skipped"
    state["last_run"] = {
        "mode": run_mode,
        "result": result,
        "reason": reason,
        "sent_count": sent_count,
        "attempted_count": attempted_count,
    }
    _write_json(STATE_PATH, state)
    print(f"[brevo] mode={run_mode} result={result} sent={sent_count} attempted={attempted_count}")


if __name__ == "__main__":
    main()
