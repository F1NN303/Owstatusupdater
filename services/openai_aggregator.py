from __future__ import annotations

import datetime as dt
import re
import threading
import time
from typing import Any, Callable

import requests

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
    _sort_by_datetime,
    _source_freshness,
)
from services.core.source_runner import (
    CallableSourceAdapter,
    SourceAdapterSpec,
    SourceRunResult,
    run_source_adapter,
)

UA = {"User-Agent": "OpenAI-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

OPENAI_STATUS_PAGE_URL = "https://status.openai.com/"
OPENAI_STATUS_API_STATUS_URL = "https://status.openai.com/api/v2/status.json"
OPENAI_STATUS_API_COMPONENTS_URL = "https://status.openai.com/api/v2/components.json"
OPENAI_STATUS_API_INCIDENTS_URL = "https://status.openai.com/api/v2/incidents.json"
OPENAI_STATUS_HISTORY_RSS_URL = "https://status.openai.com/history.rss"

STATUSGATOR_URL = "https://statusgator.com/services/openai"
ISDOWN_STATUS_URL = "https://isdown.app/status/chatgpt"

OPENAI_STATUSPAGE_API_DOCS_URL = "https://support.atlassian.com/statuspage/docs/what-are-the-different-apis-under-statuspage/"
OPENAI_HELP_STATUS_URL = "https://help.openai.com/en/articles/6614161-how-can-i-contact-support"

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _run_openai_source(
    *,
    adapter_id: str,
    name: str,
    kind: str,
    url: str,
    fetch_fn: Callable[[], Any],
    item_count_fn: Callable[[Any], int | None],
    last_item_at_fn: Callable[[Any], str | None],
    cache_ttl_seconds: int = CACHE_TTL_SECONDS,
) -> SourceRunResult[Any]:
    return run_source_adapter(
        CallableSourceAdapter(
            spec=SourceAdapterSpec(
                service_id="openai",
                adapter_id=adapter_id,
                name=name,
                kind=kind,
                url=url,
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
    end = _parse_iso8601(ended_at)
    if not start:
        return None
    target = end or _utc_now()
    seconds = max(int((target - start).total_seconds()), 0)
    if seconds <= 0:
        return "ongoing" if end is None else "0m"
    days, rem = divmod(seconds, 24 * 3600)
    hours, rem = divmod(rem, 3600)
    mins = rem // 60
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if mins or not parts:
        parts.append(f"{mins}m")
    if end is None:
        parts.append("ongoing")
    return " ".join(parts)


def _humanize_status_token(value: Any) -> str:
    text = _clean(str(value or ""))
    if not text:
        return ""
    text = text.replace("_", " ")
    return " ".join(part.capitalize() for part in text.split())


def _statuspage_indicator_to_outage_status(indicator: Any) -> str:
    token = _clean(str(indicator or "")).lower()
    if token in {"none", "operational"}:
        return "operational"
    if token in {"critical", "major", "major_outage"}:
        return "major outage"
    if token in {"minor", "maintenance", "under_maintenance"}:
        return "degraded"
    return _normalize_outage_status_text(token)


def _component_status_to_outage_status(status: Any) -> str:
    token = _clean(str(status or "")).lower()
    if token in {"operational", "none"}:
        return "operational"
    if token in {"major_outage", "partial_outage"}:
        return "major outage" if token == "major_outage" else "degraded"
    if token in {"degraded_performance", "under_maintenance"}:
        return "degraded"
    return _normalize_outage_status_text(token)


def _incident_status_is_active(incident: dict[str, Any]) -> bool:
    if incident.get("resolved_at"):
        return False
    status_token = _clean(str(incident.get("status") or "")).lower()
    if status_token in {"resolved", "postmortem", "completed"}:
        return False
    return True


def _statuspage_incident_url(incident_id: str, update_id: str | None = None) -> str:
    base = f"{OPENAI_STATUS_PAGE_URL.rstrip('/')}/incidents/{incident_id}"
    if update_id:
        return f"{base}#{update_id}"
    return base


def _official_incident_to_outage_incident(incident: dict[str, Any]) -> dict[str, Any]:
    title = _clean(incident.get("name")) or "OpenAI incident"
    started_at = (
        _clean(incident.get("created_at"))
        or _clean(incident.get("updated_at"))
        or None
    )
    resolved_at = _clean(incident.get("resolved_at")) or None
    impact = _humanize_status_token(incident.get("impact"))
    status_label = _humanize_status_token(incident.get("status"))
    ack_parts = [part for part in (impact, status_label) if part]
    incident_id = _clean(incident.get("id"))
    return {
        "title": title,
        "started_at": started_at,
        "duration": _format_human_duration(started_at, resolved_at),
        "acknowledgement": " / ".join(ack_parts) if ack_parts else "OpenAI Statuspage",
        "source": "OpenAI Statuspage API",
        "url": _statuspage_incident_url(incident_id) if incident_id else OPENAI_STATUS_PAGE_URL,
    }


def _official_incident_update_rows(incident: dict[str, Any]) -> list[dict[str, Any]]:
    incident_id = _clean(incident.get("id"))
    incident_name = _clean(incident.get("name")) or "OpenAI incident"
    impact_label = _humanize_status_token(incident.get("impact"))
    incident_status_label = _humanize_status_token(incident.get("status"))
    updates = incident.get("incident_updates")
    if not isinstance(updates, list):
        return []

    rows: list[dict[str, Any]] = []
    for update in updates:
        if not isinstance(update, dict):
            continue
        update_id = _clean(update.get("id"))
        update_status = _humanize_status_token(update.get("status"))
        body = _clean(update.get("body"))
        published_at = (
            _clean(update.get("display_at"))
            or _clean(update.get("updated_at"))
            or _clean(update.get("created_at"))
            or None
        )
        if not published_at:
            continue
        meta_parts = [part for part in (update_status, impact_label, incident_status_label) if part]
        if body:
            meta_parts.append(body[:240])
        rows.append(
            {
                "title": incident_name,
                "url": _statuspage_incident_url(incident_id, update_id) if incident_id else OPENAI_STATUS_PAGE_URL,
                "published_at": published_at,
                "source": "OpenAI Statuspage API",
                "channel": "official-status-page",
                "meta": " / ".join(meta_parts) if meta_parts else "Statuspage incident update",
            }
        )
    return rows


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


def _statuspage_component_rows(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        name = _clean(component.get("name"))
        raw_status = _clean(component.get("status"))
        if not name:
            continue
        mapped = _component_status_to_outage_status(raw_status)
        rows.append(
            {
                "name": name,
                "status": mapped if mapped != "unknown" else (raw_status or "unknown"),
                "health": raw_status or mapped or "unknown",
                "updated_at": _clean(component.get("updated_at")) or None,
                "source": "OpenAI Statuspage API",
            }
        )
    return rows


def _statuspage_top_issue_labels(components: list[dict[str, Any]], *, limit: int = 8) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        label = _clean(component.get("name"))
        status_value = _component_status_to_outage_status(component.get("status"))
        if not label or status_value in {"unknown", "operational"}:
            continue
        rows.append({"label": label, "count": 1})
        if len(rows) >= limit:
            break
    return rows


def _build_openai_official_summary(
    *,
    description: str,
    active_incidents: list[dict[str, Any]],
    recent_incidents: list[dict[str, Any]],
) -> str:
    if active_incidents:
        latest = active_incidents[0]
        latest_title = _clean(latest.get("title")) or "OpenAI incident"
        if len(active_incidents) == 1:
            return f"OpenAI Statuspage reports an active incident: {latest_title}."
        return f"OpenAI Statuspage reports {len(active_incidents)} active incidents. Latest: {latest_title}."

    latest_started_at = (
        _clean(recent_incidents[0].get("started_at")) if recent_incidents else None
    )
    latest_age_h = _hours_since(latest_started_at)
    if description and isinstance(latest_age_h, float):
        rounded = max(1, int(round(latest_age_h)))
        if latest_age_h <= 24:
            return (
                f"OpenAI Statuspage reports {description}. "
                f"Latest listed incident started about {rounded}h ago."
            )
        return (
            f"OpenAI Statuspage reports {description}. "
            f"Latest listed incident was about {rounded}h ago."
        )
    if description:
        return f"OpenAI Statuspage reports {description}."
    if recent_incidents:
        return f"OpenAI Statuspage incident history is available. Latest listed incident: {recent_incidents[0].get('title')}."
    return "Official OpenAI status information is currently unavailable."


def fetch_openai_statuspage_bundle() -> dict[str, Any]:
    checked_at = _utc_now_iso()
    status_payload = _request_json(OPENAI_STATUS_API_STATUS_URL)
    components_payload = _request_json(OPENAI_STATUS_API_COMPONENTS_URL)
    incidents_payload = _request_json(OPENAI_STATUS_API_INCIDENTS_URL)

    status_block = status_payload.get("status") if isinstance(status_payload, dict) else {}
    status_block = status_block if isinstance(status_block, dict) else {}
    indicator = _clean(status_block.get("indicator")) or "unknown"
    description = _clean(status_block.get("description")) or "Status description unavailable"
    current_status = _statuspage_indicator_to_outage_status(indicator)

    raw_components = components_payload.get("components") if isinstance(components_payload, dict) else []
    raw_components = [row for row in (raw_components or []) if isinstance(row, dict)]
    component_rows = _statuspage_component_rows(raw_components)

    raw_incidents = incidents_payload.get("incidents") if isinstance(incidents_payload, dict) else []
    valid_incidents = [row for row in (raw_incidents or []) if isinstance(row, dict)]
    valid_incidents = sorted(
        valid_incidents,
        key=lambda item: _parse_iso8601(
            _clean(item.get("updated_at")) or _clean(item.get("created_at"))
        )
        or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )

    official_incidents = [_official_incident_to_outage_incident(item) for item in valid_incidents][:12]
    active_incidents = [
        _official_incident_to_outage_incident(item)
        for item in valid_incidents
        if _incident_status_is_active(item)
    ][:8]

    official_updates: list[dict[str, Any]] = [
        {
            "title": f"OpenAI Statuspage: {description}",
            "url": OPENAI_STATUS_PAGE_URL,
            "published_at": checked_at,
            "source": "OpenAI Statuspage API",
            "channel": "official-status-page",
            "meta": f"Indicator: {indicator}",
        }
    ]
    for incident in valid_incidents[:12]:
        official_updates.extend(_official_incident_update_rows(incident))
    official_updates = _sort_by_datetime(_dedupe_by_url(official_updates), field="published_at")[:24]

    top_issues = _statuspage_top_issue_labels(component_rows)
    summary = _build_openai_official_summary(
        description=description,
        active_incidents=active_incidents,
        recent_incidents=official_incidents,
    )

    return {
        "source": "OpenAI Statuspage API",
        "url": OPENAI_STATUS_PAGE_URL,
        "checked_at": checked_at,
        "indicator": indicator,
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
            f"StatusGator indicates OpenAI / ChatGPT is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator indicates OpenAI / ChatGPT is currently {normalized_status}. "
                    f"Most recent listed incident started about {rounded_age_hours}h ago."
                )
            return (
                f"StatusGator indicates OpenAI / ChatGPT is currently {normalized_status}. "
                f"Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator indicates OpenAI / ChatGPT is currently {normalized_status}."
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
    summary = f"IsDown indicates ChatGPT is {status_phrase}."
    lowered = status_phrase.lower()
    if any(token in lowered for token in ("working normally", "operational", "online")):
        current_status = "operational"
    elif any(token in lowered for token in ("major outage", "outage", "down", "offline")):
        current_status = "major outage"
    elif any(token in lowered for token in ("partial outage", "degraded", "issue", "maintenance")):
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
    if not isinstance(payload, dict):
        return None
    last_item_at = _latest_timestamp(payload.get("incidents") or [], "started_at")
    if not last_item_at and isinstance(payload.get("service_health_24h_meta"), dict):
        last_item_at = payload["service_health_24h_meta"].get("last_sample_at")
    return last_item_at


def _isdown_item_count(payload: Any) -> int | None:
    return len(payload.get("user_reports_24h") or []) if isinstance(payload, dict) else 0


def _isdown_last_item_at(payload: Any) -> str | None:
    return str(payload.get("last_reviewed_at") or "") or None if isinstance(payload, dict) else None


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
                "title": _clean(item.get("title")) or "OpenAI status update",
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "OpenAI Statuspage API",
                "channel": "official-status-page",
                "meta": item.get("meta"),
            }
        )
    updates = updates[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official OpenAI status updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _collect_payload() -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    official_status: dict[str, Any] | None = None
    isdown_outage: dict[str, Any] | None = None

    statusgator_run = _run_openai_source(
        adapter_id="statusgator",
        name="StatusGator",
        kind="outage-index",
        url=STATUSGATOR_URL,
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

    isdown_run = _run_openai_source(
        adapter_id="isdown_chatgpt",
        name="IsDown (ChatGPT)",
        kind="outage-index-alt",
        url=ISDOWN_STATUS_URL,
        fetch_fn=fetch_isdown_outages,
        item_count_fn=_isdown_item_count,
        last_item_at_fn=_isdown_last_item_at,
    )
    sources.append(isdown_run.source)
    if isdown_run.ok and isinstance(isdown_run.data, dict):
        isdown_outage = isdown_run.data

    outage = _merge_secondary_outage_signal(outage, isdown_outage)

    official_run = _run_openai_source(
        adapter_id="openai_statuspage_api",
        name="OpenAI Statuspage API",
        kind="official-api",
        url=OPENAI_STATUS_API_STATUS_URL,
        fetch_fn=fetch_openai_statuspage_bundle,
        item_count_fn=_official_item_count,
        last_item_at_fn=_official_last_item_at,
    )
    sources.append(official_run.source)
    if official_run.ok and isinstance(official_run.data, dict):
        official_status = official_run.data

    if official_status:
        official_status_text = _normalize_outage_status_text(official_status.get("current_status"))
        if official_status_text != "unknown":
            outage["current_status"] = official_status_text
            outage["current_status_origin"] = "OpenAI Statuspage API"
        if official_status.get("summary"):
            outage["summary"] = official_status.get("summary")
            outage["summary_origin"] = "OpenAI Statuspage API"
        outage["url"] = OPENAI_STATUS_PAGE_URL

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

        if (
            not isinstance(outage.get("top_reported_issues"), list)
            or not outage.get("top_reported_issues")
        ):
            top_component_issues = official_status.get("top_component_issues")
            if isinstance(top_component_issues, list) and top_component_issues:
                outage["top_reported_issues"] = top_component_issues
                outage["top_reported_issues_meta"] = {
                    "source": "OpenAI Statuspage API",
                    "kind": "degraded-components",
                    "mode": "active" if int(official_status.get("active_incident_count") or 0) > 0 else "snapshot",
                }

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
    analytics = _calculate_severity(outage, sources, health, reports, news, social)
    analytics["model_version"] = "openai-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "OpenAI Status page",
            "url": OPENAI_STATUS_PAGE_URL,
            "source": "Official",
            "meta": "Statuspage",
            "published_at": generated_at,
        },
        {
            "title": "OpenAI Status API (Statuspage v2)",
            "url": OPENAI_STATUS_API_STATUS_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "OpenAI Status history RSS",
            "url": OPENAI_STATUS_HISTORY_RSS_URL,
            "source": "Official",
            "meta": "RSS feed",
            "published_at": generated_at,
        },
        {
            "title": "Statuspage API overview (Atlassian)",
            "url": OPENAI_STATUSPAGE_API_DOCS_URL,
            "source": "Official",
            "meta": "Statuspage docs",
            "published_at": generated_at,
        },
        {
            "title": "OpenAI Help Center",
            "url": OPENAI_HELP_STATUS_URL,
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


def build_dashboard_payload(force_refresh: bool = False) -> dict[str, Any]:
    global _CACHE_TS
    global _CACHE_PAYLOAD

    with _CACHE_LOCK:
        now = time.time()
        if not force_refresh and _CACHE_PAYLOAD and (now - _CACHE_TS) < CACHE_TTL_SECONDS:
            return _CACHE_PAYLOAD

    payload = _collect_payload()
    with _CACHE_LOCK:
        _CACHE_PAYLOAD = payload
        _CACHE_TS = time.time()
        return _CACHE_PAYLOAD


__all__ = ["build_dashboard_payload"]
