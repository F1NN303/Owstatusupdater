from __future__ import annotations

import datetime as dt
import re
import threading
import time
from typing import Any, Callable

import requests
from bs4 import BeautifulSoup

from services.adapters.isdown import parse_isdown_outage_html
from services.adapters.statusgator import parse_statusgator_outage_html
from services.core.shared import (
    _build_region_signals,
    _calculate_severity,
    _clean,
    _dedupe_by_url,
    _latest_timestamp,
    _merge_secondary_outage_signal,
    _normalize_outage_status_text,
    _safe_error_message,
    _safe_http_url,
    _sort_by_datetime,
    _source_freshness,
)
from services.core.source_runner import (
    CallableSourceAdapter,
    SourceAdapterSpec,
    SourceRunResult,
    run_source_adapter,
)

UA = {"User-Agent": "Slack-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

SLACK_STATUS_PAGE_URL = "https://slack-status.com/"
SLACK_STATUS_API_CURRENT_URL = "https://slack-status.com/api/v2.0.0/current"
SLACK_STATUS_API_HISTORY_URL = "https://slack-status.com/api/v2.0.0/history"
SLACK_STATUS_HISTORY_RSS_URL = "https://slack-status.com/feed/rss"

STATUSGATOR_URL = "https://statusgator.com/services/slack"
ISDOWN_STATUS_URL = "https://isdown.app/status/slack"

SLACK_STATUS_API_DOCS_URL = "https://slack-status.com/api"
SLACK_HELP_STATUS_URL = "https://slack.com/help/articles/205138367-Troubleshoot-connection-issues"

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _run_slack_source(
    *,
    adapter_id: str,
    name: str,
    kind: str,
    url: str,
    role: str = "provider",
    criticality: str = "supporting",
    used_for_scoring: bool = True,
    fetch_fn: Callable[[], Any],
    item_count_fn: Callable[[Any], int | None],
    last_item_at_fn: Callable[[Any], str | None],
    cache_ttl_seconds: int = CACHE_TTL_SECONDS,
) -> SourceRunResult[Any]:
    return run_source_adapter(
        CallableSourceAdapter(
            spec=SourceAdapterSpec(
                service_id="slack",
                adapter_id=adapter_id,
                name=name,
                kind=kind,
                url=url,
                role=role,
                criticality=criticality,
                used_for_scoring=used_for_scoring,
                cache_ttl_seconds=cache_ttl_seconds,
            ),
            fetch_fn=fetch_fn,
            item_count_fn=item_count_fn,
            last_item_at_fn=last_item_at_fn,
        ),
        utc_now_iso=_utc_now_iso,
        source_freshness=_source_freshness,
        safe_error_message=_safe_error_message,
    )


def _request_text(url: str, timeout: int = REQUEST_TIMEOUT) -> str:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.text


def _request_json(url: str, timeout: int = REQUEST_TIMEOUT) -> Any:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.json()


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _hours_since(value: str | None) -> float | None:
    parsed = _parse_iso8601(value)
    if not parsed:
        return None
    delta = _utc_now() - parsed
    return max(delta.total_seconds() / 3600.0, 0.0)


def _format_human_duration(started_at: str | None, ended_at: str | None) -> str | None:
    start = _parse_iso8601(started_at)
    if not start:
        return None
    end = _parse_iso8601(ended_at) or _utc_now()
    total_seconds = max(int((end - start).total_seconds()), 0)
    if total_seconds <= 0:
        return "ongoing" if ended_at is None else "0m"
    days, remainder = divmod(total_seconds, 24 * 3600)
    hours, remainder = divmod(remainder, 3600)
    minutes = remainder // 60
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes or not parts:
        parts.append(f"{minutes}m")
    if ended_at is None:
        parts.append("ongoing")
    return " ".join(parts)


def _merge_incidents(
    primary: list[dict[str, Any]],
    secondary: list[dict[str, Any]],
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()
    for item in [*(primary or []), *(secondary or [])]:
        if not isinstance(item, dict):
            continue
        title = _clean(item.get("title"))
        started_at = _clean(item.get("started_at")) or None
        if not title:
            continue
        key = (title, started_at)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return _sort_by_datetime(out, field="started_at")[:limit]


def _slack_status_token_to_outage_status(value: Any) -> str:
    token = _clean(str(value or "")).lower()
    if token in {"ok", "up", "operational", "no issues"}:
        return "operational"
    if token in {"outage", "major outage", "down", "offline"}:
        return "major outage"
    if token in {"incident", "maintenance", "notice", "active", "degraded"}:
        return "degraded"
    return _normalize_outage_status_text(token)


def _slack_component_status_to_outage_status(value: Any) -> str:
    token = _clean(str(value or "")).lower()
    if token == "no issues":
        return "operational"
    return _slack_status_token_to_outage_status(token)


def _slack_incident_services(incident: dict[str, Any]) -> list[str]:
    raw_services = incident.get("services")
    if not isinstance(raw_services, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw_services:
        service_name = _clean(str(item or ""))
        if not service_name or service_name in seen:
            continue
        seen.add(service_name)
        out.append(service_name)
    return out


def _slack_incident_status_label(value: Any) -> str:
    token = _clean(str(value or "")).replace("_", " ")
    return " ".join(part.capitalize() for part in token.split())


def _slack_incident_severity(incident: dict[str, Any]) -> str:
    incident_type = _slack_status_token_to_outage_status(incident.get("type"))
    if incident_type != "unknown":
        return incident_type
    return _slack_status_token_to_outage_status(incident.get("status"))


def _rollup_component_status(components: list[dict[str, Any]]) -> str:
    seen_degraded = False
    for component in components:
        if not isinstance(component, dict):
            continue
        status = _normalize_outage_status_text(component.get("status"))
        if status == "major outage":
            return "major outage"
        if status == "degraded":
            seen_degraded = True
    if seen_degraded:
        return "degraded"
    return "operational" if components else "unknown"


def _rollup_active_incident_status(incidents: list[dict[str, Any]]) -> str:
    seen_degraded = False
    for incident in incidents:
        if not isinstance(incident, dict):
            continue
        severity = _slack_incident_severity(incident)
        if severity == "major outage":
            return "major outage"
        if severity == "degraded":
            seen_degraded = True
    if seen_degraded:
        return "degraded"
    return "unknown"


def _slack_note_text(value: Any) -> str:
    raw = str(value or "")
    if not raw:
        return ""
    soup = BeautifulSoup(raw, "html.parser")
    return _clean(soup.get_text(" ", strip=True))


def _slack_incident_acknowledgement(incident: dict[str, Any], source_name: str) -> str:
    parts: list[str] = []
    incident_type = _slack_incident_status_label(incident.get("type"))
    incident_status = _slack_incident_status_label(incident.get("status"))
    services = _slack_incident_services(incident)
    if incident_type:
        parts.append(incident_type)
    if incident_status:
        parts.append(incident_status)
    if services:
        parts.append(", ".join(services[:3]))
    return " / ".join(parts) if parts else source_name


def _slack_incident_to_outage_incident(
    incident: dict[str, Any],
    *,
    source_name: str,
) -> dict[str, Any]:
    title = _clean(incident.get("title")) or "Slack incident"
    started_at = _clean(incident.get("date_created")) or _clean(incident.get("date_updated")) or None
    status_token = _clean(incident.get("status")).lower()
    ended_at = _clean(incident.get("date_updated")) if status_token in {"resolved", "completed"} else None
    url = _safe_http_url(incident.get("url")) or SLACK_STATUS_PAGE_URL
    return {
        "title": title,
        "started_at": started_at,
        "duration": _format_human_duration(started_at, ended_at),
        "acknowledgement": _slack_incident_acknowledgement(incident, source_name),
        "source": source_name,
        "url": url,
    }


def _slack_incident_update_rows(
    incident: dict[str, Any],
    *,
    source_name: str,
) -> list[dict[str, Any]]:
    notes = incident.get("notes")
    if not isinstance(notes, list):
        return []
    incident_url = _safe_http_url(incident.get("url")) or SLACK_STATUS_PAGE_URL
    incident_title = _clean(incident.get("title")) or "Slack incident"
    services = _slack_incident_services(incident)
    incident_type = _slack_incident_status_label(incident.get("type"))
    incident_status = _slack_incident_status_label(incident.get("status"))

    rows: list[dict[str, Any]] = []
    for index, note in enumerate(notes):
        if not isinstance(note, dict):
            continue
        published_at = _clean(note.get("date_created")) or _clean(incident.get("date_updated")) or None
        if not published_at:
            continue
        note_text = _slack_note_text(note.get("body"))
        meta_parts = [part for part in (incident_status, incident_type) if part]
        if services:
            meta_parts.append(f"Services: {', '.join(services[:4])}")
        if note_text:
            meta_parts.append(note_text[:240])
        rows.append(
            {
                "title": incident_title,
                "url": f"{incident_url}#note-{index + 1}",
                "published_at": published_at,
                "source": source_name,
                "channel": "official-status-page",
                "meta": " / ".join(meta_parts) if meta_parts else "Slack incident update",
            }
        )
    return rows


def _parse_slack_component_snapshot(
    html: str,
    *,
    updated_at: str | None,
    source_name: str,
) -> tuple[str, list[dict[str, Any]]]:
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.select_one("#current_status h1")
    description = _clean(heading.get_text(" ", strip=True) if heading else "") or "Status description unavailable"

    components: list[dict[str, Any]] = []
    for row in soup.select("#services .service"):
        name_tag = row.select_one("p.bold")
        status_tag = row.select_one("p.tiny")
        name = _clean(name_tag.get_text(" ", strip=True) if name_tag else "")
        health = _clean(status_tag.get_text(" ", strip=True) if status_tag else "")
        if not name:
            continue
        mapped_status = _slack_component_status_to_outage_status(health)
        components.append(
            {
                "name": name,
                "status": mapped_status if mapped_status != "unknown" else (health or "unknown"),
                "health": health or mapped_status or "unknown",
                "updated_at": updated_at,
                "source": source_name,
            }
        )
    return description, components


def _slack_top_component_issues(
    components: list[dict[str, Any]],
    active_incidents: list[dict[str, Any]],
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        name = _clean(component.get("name"))
        status = _normalize_outage_status_text(component.get("status"))
        if not name or status in {"unknown", "operational"}:
            continue
        issues.append({"label": name, "count": 1})
        if len(issues) >= limit:
            return issues

    seen_services: set[str] = set()
    for incident in active_incidents:
        if not isinstance(incident, dict):
            continue
        for service_name in _slack_incident_services(incident):
            if service_name in seen_services:
                continue
            seen_services.add(service_name)
            issues.append({"label": service_name, "count": 1})
            if len(issues) >= limit:
                return issues
    return issues


def _build_slack_official_summary(
    description: str,
    current_status: str,
    active_incidents: list[dict[str, Any]],
    recent_incidents: list[dict[str, Any]],
) -> str:
    if active_incidents:
        latest = active_incidents[0]
        latest_title = _clean(latest.get("title")) or "Slack incident"
        if len(active_incidents) == 1:
            return f"Slack Status reports an active incident: {latest_title}."
        return f"Slack Status reports {len(active_incidents)} active incidents. Latest: {latest_title}."

    normalized_status = _normalize_outage_status_text(current_status)
    if normalized_status == "operational" and description:
        return f"Slack Status reports {description}. No active incidents are listed."

    latest_started_at = _clean(recent_incidents[0].get("started_at")) if recent_incidents else None
    latest_age_h = _hours_since(latest_started_at)
    if description and isinstance(latest_age_h, float):
        rounded = max(1, int(round(latest_age_h)))
        if latest_age_h <= 24:
            return f"Slack Status reports {description}. Latest listed incident started about {rounded}h ago."
        return f"Slack Status reports {description}. Latest listed incident was about {rounded}h ago."
    if description:
        return f"Slack Status reports {description}."
    if recent_incidents:
        latest_title = _clean(recent_incidents[0].get("title")) or "Slack incident"
        return f"Slack incident history is available. Latest listed incident: {latest_title}."
    return "Official Slack status information is currently unavailable."


def fetch_slack_status_bundle() -> dict[str, Any]:
    checked_at = _utc_now_iso()
    current_payload = _request_json(SLACK_STATUS_API_CURRENT_URL)
    history_payload = _request_json(SLACK_STATUS_API_HISTORY_URL)
    page_html = _request_text(SLACK_STATUS_PAGE_URL)

    current_items = current_payload.get("active_incidents") if isinstance(current_payload, dict) else []
    current_items = [item for item in (current_items or []) if isinstance(item, dict)]

    history_items = history_payload if isinstance(history_payload, list) else []
    history_items = [item for item in history_items if isinstance(item, dict)]
    history_items = sorted(
        history_items,
        key=lambda item: _parse_iso8601(_clean(item.get("date_updated")) or _clean(item.get("date_created")))
        or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )

    source_name = "Slack Status API"
    description, component_rows = _parse_slack_component_snapshot(
        page_html,
        updated_at=(
            _clean(current_payload.get("date_updated")) if isinstance(current_payload, dict) else None
        )
        or checked_at,
        source_name=source_name,
    )

    active_incidents = [
        _slack_incident_to_outage_incident(item, source_name=source_name)
        for item in current_items[:8]
    ]
    recent_incidents = [
        _slack_incident_to_outage_incident(item, source_name=source_name)
        for item in history_items[:12]
    ]
    official_incidents = _merge_incidents(active_incidents, recent_incidents, limit=12)

    official_updates: list[dict[str, Any]] = [
        {
            "title": f"{source_name}: {description}",
            "url": SLACK_STATUS_PAGE_URL,
            "published_at": checked_at,
            "source": source_name,
            "channel": "official-status-page",
            "meta": f"Indicator: {_clean(current_payload.get('status')) or 'unknown'}",
        }
    ]
    for incident in current_items[:8]:
        official_updates.extend(_slack_incident_update_rows(incident, source_name=source_name))
    for incident in history_items[:12]:
        official_updates.extend(_slack_incident_update_rows(incident, source_name=source_name))
    official_updates = _sort_by_datetime(_dedupe_by_url(official_updates), field="published_at")[:24]

    current_status = _rollup_component_status(component_rows)
    active_status = _rollup_active_incident_status(current_items)
    if active_status == "major outage" or current_status == "major outage":
        current_status = "major outage"
    elif active_status == "degraded" or current_status == "degraded":
        current_status = "degraded"
    elif current_status == "unknown":
        current_status = _slack_status_token_to_outage_status(
            current_payload.get("status") if isinstance(current_payload, dict) else None
        )

    top_issues = _slack_top_component_issues(component_rows, current_items)
    summary = _build_slack_official_summary(description, current_status, active_incidents, official_incidents)

    return {
        "source": source_name,
        "url": SLACK_STATUS_PAGE_URL,
        "checked_at": checked_at,
        "indicator": _clean(current_payload.get("status")) if isinstance(current_payload, dict) else "unknown",
        "description": description,
        "summary": summary,
        "current_status": current_status,
        "components": component_rows,
        "incidents": official_incidents,
        "active_incidents": active_incidents,
        "updates": official_updates,
        "top_component_issues": top_issues,
        "active_incident_count": len(active_incidents),
        "incident_count": len(official_incidents),
    }


def _synthesize_statusgator_summary(
    current_status: str,
    reports_24h: int | None,
    incidents: list[dict[str, Any]],
    top_reported_issues: list[dict[str, Any]],
) -> str:
    normalized_status = _normalize_outage_status_text(current_status)
    latest_incident_age_hours = _hours_since(
        str(incidents[0].get("started_at")) if incidents else None
    )
    if normalized_status != "unknown" and isinstance(reports_24h, int):
        return (
            f"StatusGator indicates Slack is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator indicates Slack is currently {normalized_status}. "
                    f"Most recent listed incident started about {rounded_age_hours}h ago."
                )
            return (
                f"StatusGator indicates Slack is currently {normalized_status}. "
                f"Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator indicates Slack is currently {normalized_status}."
    if incidents:
        latest_title = _clean(str(incidents[0].get("title") or "Recent incident listed"))
        return f"StatusGator incident table is available. Latest listed incident: {latest_title}."
    if top_reported_issues:
        top_label = _clean(str(top_reported_issues[0].get("label") or "Community issue signal"))
        return f"StatusGator community issue labels are available (top label: {top_label})."
    return "Status summary unavailable."


def fetch_statusgator_outages() -> dict[str, Any]:
    html = _request_text(STATUSGATOR_URL)
    return parse_statusgator_outage_html(
        html,
        source_url=STATUSGATOR_URL,
        summary_regex=r"StatusGator reports that .*? is currently .*?past 24 hours\.",
        synthesize_summary=_synthesize_statusgator_summary,
    )


def _extract_isdown_status_text(page_text: str) -> tuple[str, str]:
    summary_match = re.search(
        r"What is .*? status right now\?\s+.*? is (.+?)\s+IsDown last checked",
        page_text,
        flags=re.IGNORECASE,
    )
    if not summary_match:
        return "Status summary unavailable.", "unknown"
    status_phrase = _clean(summary_match.group(1))
    summary = f"IsDown indicates Slack is {status_phrase}."
    lowered = status_phrase.lower()
    if any(token in lowered for token in ("working normally", "operational", "online")):
        current_status = "operational"
    elif any(token in lowered for token in ("major outage", "outage", "down", "offline")):
        current_status = "major outage"
    elif any(token in lowered for token in ("partial outage", "minor outage", "degraded", "issue", "maintenance")):
        current_status = "degraded"
    else:
        current_status = lowered or "unknown"
    return summary, current_status


def fetch_isdown_outages() -> dict[str, Any]:
    html = _request_text(ISDOWN_STATUS_URL)
    return parse_isdown_outage_html(
        html,
        source_url=ISDOWN_STATUS_URL,
        extract_status_text=_extract_isdown_status_text,
    )


def _statusgator_item_count(payload: Any) -> int | None:
    return len(payload.get("incidents") or []) if isinstance(payload, dict) else 0


def _statusgator_last_item_at(payload: Any) -> str | None:
    # Status index freshness is based on successful fetch time, not incident recency.
    return _utc_now_iso() if isinstance(payload, dict) else None


def _isdown_item_count(payload: Any) -> int | None:
    return len(payload.get("user_reports_24h") or []) if isinstance(payload, dict) else 0


def _isdown_last_item_at(payload: Any) -> str | None:
    return str(payload.get("last_reviewed_at") or "") or None if isinstance(payload, dict) else None


def _effective_active_incident_count(official_status: dict[str, Any] | None) -> int:
    if not isinstance(official_status, dict):
        return 0
    active_incidents = official_status.get("active_incidents")
    if isinstance(active_incidents, list):
        return len([item for item in active_incidents if isinstance(item, dict)])
    return int(official_status.get("active_incident_count") or 0)


def _official_item_count(payload: Any) -> int | None:
    if not isinstance(payload, dict):
        return 0
    return len(payload.get("updates") or []) or int(payload.get("active_incident_count") or 0)


def _official_last_item_at(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    last_item_at = _latest_timestamp(payload.get("updates") or [], "published_at")
    if not last_item_at:
        last_item_at = payload.get("checked_at")
    return str(last_item_at or "") or None


def _build_official_block(official_updates: list[dict[str, Any]]) -> dict[str, Any]:
    updates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in _sort_by_datetime(official_updates, field="published_at"):
        url = str(item.get("url") or "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        updates.append(
            {
                "title": _clean(item.get("title")) or "Slack status update",
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "Slack Status API",
                "channel": "official-status-page",
                "meta": item.get("meta"),
            }
        )
    updates = updates[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official Slack status updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _collect_payload(scoring_profile: str | None = None) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    official_status: dict[str, Any] | None = None
    official_source_entry: dict[str, Any] | None = None
    isdown_outage: dict[str, Any] | None = None

    statusgator_run = _run_slack_source(
        adapter_id="statusgator",
        name="StatusGator",
        kind="outage-index",
        url=STATUSGATOR_URL,
        role="provider",
        criticality="supporting",
        used_for_scoring=True,
        fetch_fn=fetch_statusgator_outages,
        item_count_fn=_statusgator_item_count,
        last_item_at_fn=_statusgator_last_item_at,
    )
    sources.append(statusgator_run.source)
    if statusgator_run.ok and isinstance(statusgator_run.data, dict):
        outage = statusgator_run.data
    else:
        outage = {
            "source": "StatusGator",
            "source_type": "Downdetector-like",
            "url": STATUSGATOR_URL,
            "summary": "Outage source temporarily unavailable.",
            "current_status": "unknown",
            "reports_24h": None,
            "incidents": [],
            "top_reported_issues": [],
        }

    isdown_run = _run_slack_source(
        adapter_id="isdown_slack",
        name="IsDown (Slack)",
        kind="outage-index-alt",
        url=ISDOWN_STATUS_URL,
        role="provider",
        criticality="supporting",
        used_for_scoring=True,
        fetch_fn=fetch_isdown_outages,
        item_count_fn=_isdown_item_count,
        last_item_at_fn=_isdown_last_item_at,
    )
    sources.append(isdown_run.source)
    if isdown_run.ok and isinstance(isdown_run.data, dict):
        isdown_outage = isdown_run.data

    outage = _merge_secondary_outage_signal(outage, isdown_outage)

    official_run = _run_slack_source(
        adapter_id="slack_status_api",
        name="Slack Status API",
        kind="official-api",
        url=SLACK_STATUS_API_CURRENT_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_slack_status_bundle,
        item_count_fn=_official_item_count,
        last_item_at_fn=_official_last_item_at,
    )
    sources.append(official_run.source)
    official_source_entry = official_run.source
    if official_run.ok and isinstance(official_run.data, dict):
        official_status = official_run.data

    if official_status:
        official_status_text = _normalize_outage_status_text(official_status.get("current_status"))
        if official_status_text != "unknown":
            outage["current_status"] = official_status_text
            outage["current_status_origin"] = "Slack Status API"
        if official_status.get("summary"):
            outage["summary"] = official_status.get("summary")
            outage["summary_origin"] = "Slack Status API"
        outage["url"] = SLACK_STATUS_PAGE_URL

        official_components = official_status.get("components")
        if isinstance(official_components, list) and official_components:
            outage["components"] = official_components

        official_incidents = official_status.get("incidents")
        if isinstance(official_incidents, list) and official_incidents:
            outage["incidents"] = _merge_incidents(
                official_incidents,
                outage.get("incidents") or [],
                limit=8,
            )

        provider_top_issues = (
            list(outage.get("top_reported_issues"))
            if isinstance(outage.get("top_reported_issues"), list)
            else []
        )
        official_source_freshness = str((official_source_entry or {}).get("freshness") or "").lower()
        top_component_issues = official_status.get("top_component_issues")
        effective_active_incident_count = _effective_active_incident_count(official_status)
        if isinstance(top_component_issues, list) and top_component_issues:
            outage["top_reported_issues"] = top_component_issues
            outage["top_reported_issues_meta"] = {
                "source": "Slack Status API",
                "kind": "component-grid",
                "mode": "active" if effective_active_incident_count > 0 else "snapshot",
            }
            if provider_top_issues:
                outage["top_reported_issues_provider"] = provider_top_issues
        elif official_status_text == "operational" and official_source_freshness in {"fresh", "warm"}:
            outage["top_reported_issues"] = []
            outage["top_reported_issues_meta"] = {
                "source": "Slack Status API",
                "kind": "component-grid",
                "mode": "none",
            }
            if provider_top_issues:
                outage["top_reported_issues_provider"] = provider_top_issues
        elif provider_top_issues:
            outage["top_reported_issues"] = provider_top_issues

    successful_sources = sum(1 for source in sources if source.get("ok"))
    if successful_sources == 0:
        health = "error"
    elif successful_sources < len(sources):
        health = "degraded"
    else:
        health = "ok"

    reports = [
        {
            "title": incident.get("title"),
            "url": (
                incident.get("url")
                or f"{outage.get('url') or STATUSGATOR_URL}#{(incident.get('started_at') or 'incident')}"
            ),
            "published_at": incident.get("started_at"),
            "source": incident.get("source") or "StatusGator",
            "meta": incident.get("acknowledgement") or incident.get("duration"),
        }
        for incident in (outage.get("incidents") or [])
        if isinstance(incident, dict)
    ]
    reports = _sort_by_datetime(_dedupe_by_url(reports), field="published_at")[:12]

    official_status_updates = (
        [item for item in (official_status.get("updates") or []) if isinstance(item, dict)]
        if official_status
        else []
    )
    news = _sort_by_datetime(_dedupe_by_url(official_status_updates), field="published_at")[:8]
    official = _build_official_block(official_status_updates)

    social: list[dict[str, Any]] = []
    official_status_key = _normalize_outage_status_text(
        official_status.get("current_status") if isinstance(official_status, dict) else None
    )
    official_active_incident_count = _effective_active_incident_count(official_status)
    official_source_freshness = str((official_source_entry or {}).get("freshness") or "").lower()
    analytics = _calculate_severity(
        outage,
        sources,
        health,
        reports,
        news,
        social,
        scoring_profile=scoring_profile,
        scoring_profile_context={
            "official_status_key": official_status_key,
            "official_active_incident_count": official_active_incident_count,
            "official_source_freshness": official_source_freshness,
        },
    )
    analytics["model_version"] = "slack-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "Slack Status page",
            "url": SLACK_STATUS_PAGE_URL,
            "source": "Official",
            "meta": "Dashboard",
            "published_at": generated_at,
        },
        {
            "title": "Slack Status API docs",
            "url": SLACK_STATUS_API_DOCS_URL,
            "source": "Official",
            "meta": "API docs",
            "published_at": generated_at,
        },
        {
            "title": "Slack Status current API",
            "url": SLACK_STATUS_API_CURRENT_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Slack Status history API",
            "url": SLACK_STATUS_API_HISTORY_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Slack Status history RSS",
            "url": SLACK_STATUS_HISTORY_RSS_URL,
            "source": "Official",
            "meta": "RSS feed",
            "published_at": generated_at,
        },
        {
            "title": "Slack connection troubleshooting",
            "url": SLACK_HELP_STATUS_URL,
            "source": "Official",
            "meta": "Support",
            "published_at": generated_at,
        },
    ]

    return {
        "generated_at": generated_at,
        "health": health,
        "analytics": analytics,
        "regions": regions,
        "official": official,
        "outage": outage,
        "reports": reports,
        "known_resources": known_resources,
        "news": news,
        "social": social,
        "sources": sources,
    }


def build_dashboard_payload(force_refresh: bool = False, scoring_profile: str | None = None) -> dict[str, Any]:
    global _CACHE_TS
    global _CACHE_PAYLOAD

    with _CACHE_LOCK:
        now = time.time()
        if not force_refresh and _CACHE_PAYLOAD and (now - _CACHE_TS) < CACHE_TTL_SECONDS:
            return _CACHE_PAYLOAD

    payload = _collect_payload(scoring_profile=scoring_profile)
    with _CACHE_LOCK:
        _CACHE_PAYLOAD = payload
        _CACHE_TS = time.time()
        return _CACHE_PAYLOAD


__all__ = ["build_dashboard_payload"]
