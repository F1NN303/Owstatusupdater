from __future__ import annotations

import datetime as dt
import re
import threading
import time
from typing import Any, Callable

import requests

from services.adapters.isdown import parse_isdown_outage_html
from services.adapters.statuspage_json import parse_statuspage_official_payloads
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

UA = {"User-Agent": "EpicGames-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

EPIC_STATUS_PAGE_URL = "https://status.epicgames.com/"
EPIC_STATUS_API_STATUS_URL = "https://status.epicgames.com/api/v2/status.json"
EPIC_STATUS_API_COMPONENTS_URL = "https://status.epicgames.com/api/v2/components.json"
EPIC_STATUS_API_INCIDENTS_URL = "https://status.epicgames.com/api/v2/incidents.json"
EPIC_STATUS_HISTORY_RSS_URL = "https://status.epicgames.com/history.rss"

STATUSGATOR_URL = "https://statusgator.com/services/epic-games"
ISDOWN_STATUS_URL = "https://isdown.app/status/epic-games"

STATUSPAGE_API_DOCS_URL = "https://support.atlassian.com/statuspage/docs/what-are-the-different-apis-under-statuspage/"
EPIC_STATUS_API_DOCS_URL = "https://status.epicgames.com/api"
EPIC_HELP_STATUS_URL = "https://www.epicgames.com/help/"

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _run_epic_source(
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
                service_id="epic",
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


def _is_nonimpact_monitoring_incident(incident: dict[str, Any]) -> bool:
    acknowledgement = _clean(incident.get("acknowledgement")).lower()
    if not acknowledgement:
        return False
    return "none / monitoring" in acknowledgement


def _effective_active_incident_count(official_status: dict[str, Any] | None) -> int:
    if not isinstance(official_status, dict):
        return 0
    active_incidents = official_status.get("active_incidents")
    if isinstance(active_incidents, list):
        impactful = [
            incident
            for incident in active_incidents
            if isinstance(incident, dict) and not _is_nonimpact_monitoring_incident(incident)
        ]
        return len(impactful)
    return int(official_status.get("active_incident_count") or 0)


def _build_epic_official_summary(
    description: str,
    current_status: str,
    active_incidents: list[dict[str, Any]],
    recent_incidents: list[dict[str, Any]],
) -> str:
    impactful_active_incidents = [
        incident for incident in active_incidents if not _is_nonimpact_monitoring_incident(incident)
    ]

    if impactful_active_incidents:
        latest = impactful_active_incidents[0]
        latest_title = _clean(latest.get("title")) or "Epic Games incident"
        if len(impactful_active_incidents) == 1:
            return f"Epic Games Statuspage reports an active incident: {latest_title}."
        return f"Epic Games Statuspage reports {len(impactful_active_incidents)} active incidents. Latest: {latest_title}."

    normalized_status = _normalize_outage_status_text(current_status)
    if normalized_status == "operational" and description:
        return f"Epic Games Statuspage reports {description}. No active incidents are listed."

    latest_started_at = _clean(recent_incidents[0].get("started_at")) if recent_incidents else None
    latest_age_h = _hours_since(latest_started_at)
    if description and isinstance(latest_age_h, float):
        rounded = max(1, int(round(latest_age_h)))
        if latest_age_h <= 24:
            return f"Epic Games Statuspage reports {description}. Latest listed incident started about {rounded}h ago."
        return f"Epic Games Statuspage reports {description}. Latest listed incident was about {rounded}h ago."
    if description:
        return f"Epic Games Statuspage reports {description}."
    if recent_incidents:
        return f"Epic Games Statuspage incident history is available. Latest listed incident: {recent_incidents[0].get('title')}."
    return "Official Epic Games status information is currently unavailable."


def fetch_epic_statuspage_bundle() -> dict[str, Any]:
    checked_at = _utc_now_iso()
    status_payload = _request_json(EPIC_STATUS_API_STATUS_URL)
    components_payload = _request_json(EPIC_STATUS_API_COMPONENTS_URL)
    incidents_payload = _request_json(EPIC_STATUS_API_INCIDENTS_URL)
    return parse_statuspage_official_payloads(
        status_payload=status_payload,
        components_payload=components_payload,
        incidents_payload=incidents_payload,
        page_url=EPIC_STATUS_PAGE_URL,
        source_name="Epic Games Statuspage API",
        summary_builder=_build_epic_official_summary,
        checked_at=checked_at,
    )


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
            f"StatusGator indicates Epic Games is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator indicates Epic Games is currently {normalized_status}. "
                    f"Most recent listed incident started about {rounded_age_hours}h ago."
                )
            return (
                f"StatusGator indicates Epic Games is currently {normalized_status}. "
                f"Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator indicates Epic Games is currently {normalized_status}."
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
    summary = f"IsDown indicates Epic Games is {status_phrase}."
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
                "title": _clean(item.get("title")) or "Epic Games status update",
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "Epic Games Statuspage API",
                "channel": "official-status-page",
                "meta": item.get("meta"),
            }
        )
    updates = updates[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official Epic Games status updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _collect_payload(scoring_profile: str | None = None) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    official_status: dict[str, Any] | None = None
    official_source_entry: dict[str, Any] | None = None
    isdown_outage: dict[str, Any] | None = None

    statusgator_run = _run_epic_source(
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

    isdown_run = _run_epic_source(
        adapter_id="isdown_epic_games",
        name="IsDown (Epic Games)",
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

    official_run = _run_epic_source(
        adapter_id="epic_games_statuspage_api",
        name="Epic Games Statuspage API",
        kind="official-api",
        url=EPIC_STATUS_API_STATUS_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_epic_statuspage_bundle,
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
            outage["current_status_origin"] = "Epic Games Statuspage API"
        if official_status.get("summary"):
            outage["summary"] = official_status.get("summary")
            outage["summary_origin"] = "Epic Games Statuspage API"
        outage["url"] = EPIC_STATUS_PAGE_URL

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
        official_maintenances = official_status.get("scheduled_maintenances")
        if isinstance(official_maintenances, list):
            outage["scheduled_maintenances"] = official_maintenances[:8]

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
                "source": "Epic Games Statuspage API",
                "kind": "degraded-components",
                "mode": "active" if effective_active_incident_count > 0 else "snapshot",
            }
            if provider_top_issues:
                outage["top_reported_issues_provider"] = provider_top_issues
        elif official_status_text == "operational" and official_source_freshness in {"fresh", "warm"}:
            outage["top_reported_issues"] = []
            outage["top_reported_issues_meta"] = {
                "source": "Epic Games Statuspage API",
                "kind": "degraded-components",
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
    analytics["model_version"] = "epic-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "Epic Games Status page",
            "url": EPIC_STATUS_PAGE_URL,
            "source": "Official",
            "meta": "Statuspage",
            "published_at": generated_at,
        },
        {
            "title": "Epic Games Status API (Statuspage v2)",
            "url": EPIC_STATUS_API_STATUS_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Epic Games Status history RSS",
            "url": EPIC_STATUS_HISTORY_RSS_URL,
            "source": "Official",
            "meta": "RSS feed",
            "published_at": generated_at,
        },
        {
            "title": "Epic Games Status API docs",
            "url": EPIC_STATUS_API_DOCS_URL,
            "source": "Official",
            "meta": "Status API docs",
            "published_at": generated_at,
        },
        {
            "title": "Statuspage API overview (Atlassian)",
            "url": STATUSPAGE_API_DOCS_URL,
            "source": "Official",
            "meta": "Statuspage docs",
            "published_at": generated_at,
        },
        {
            "title": "Epic Games Player Support",
            "url": EPIC_HELP_STATUS_URL,
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
