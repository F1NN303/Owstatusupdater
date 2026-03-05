from __future__ import annotations

import datetime as dt
import html as html_lib
import math
import re
import threading
import time
from typing import Any, Callable

import requests
from services.adapters.isdown import parse_isdown_outage_html
from services.adapters.statusgator import parse_statusgator_outage_html
from services.adapters.sony_psn import parse_playstation_region_events
from services.core.shared import _merge_secondary_outage_signal, _normalize_outage_status_text
from services.core.source_runner import (
    CallableSourceAdapter,
    SourceAdapterSpec,
    SourceRunResult,
    run_source_adapter,
)

UA = {"User-Agent": "Sony-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

SONY_STATUS_ROOT = "https://status.playstation.com"
SONY_STATUS_URL = f"{SONY_STATUS_ROOT}/"
SONY_REGION_URL = f"{SONY_STATUS_ROOT}/data/statuses/region"
STATUSGATOR_URL = "https://statusgator.com/services/playstation"
ISDOWN_STATUS_URL = "https://isdown.app/status/playstation-network"

REGION_ENDPOINTS = {
    "na": "SCEA",
    "eu": "SCEE",
    "apac": "SCEJA",
}

REGION_LABELS = {
    "na": "North America",
    "eu": "Europe",
    "apac": "Asia Pacific",
}

SOURCE_FRESH_MINUTES_FRESH = 120
SOURCE_FRESH_MINUTES_WARM = 24 * 60
ACTIVE_EVENT_MAX_AGE_HOURS = 14 * 24
TOP_ISSUE_HISTORY_MAX_AGE_HOURS = 90 * 24
TOP_REPORTED_ISSUES_LIMIT = 8

STATUS_BASE_SCORE = {
    "outage": 4.6,
    "degraded": 2.8,
    "maintenance": 1.8,
    "ok": 0.0,
}

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _hours_since(value: str | None) -> float | None:
    parsed = _parse_iso8601(value)
    if not parsed:
        return None
    delta = _utc_now() - parsed
    return max(delta.total_seconds() / 3600.0, 0.0)


def _clean(value: str | None) -> str:
    text = html_lib.unescape(str(value or ""))
    # Repair common UTF-8 -> latin-1 mojibake sequences from upstream status messages.
    suspect_markers = ("\u00c3", "\u00c2", "\u00e2", "\u00d0", "\u00d1")
    suspect_hits = sum(text.count(marker) for marker in suspect_markers)
    if suspect_hits >= 2:
        try:
            repaired = text.encode("latin-1", "ignore").decode("utf-8", "ignore")
            if repaired:
                text = repaired
        except Exception:
            pass
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _request_json(url: str) -> dict[str, Any]:
    response = requests.get(url, timeout=REQUEST_TIMEOUT, headers=UA)
    response.raise_for_status()
    return response.json()


def _request_text(url: str) -> str:
    response = requests.get(url, timeout=REQUEST_TIMEOUT, headers=UA)
    response.raise_for_status()
    return response.text


def _safe_error_message(exc: Exception) -> str:
    return (_clean(str(exc)) or "request failed")[:220]


def _severity_from_score(score: float, source_total: int) -> str:
    if source_total <= 0:
        return "unknown"
    if score < 2.0:
        return "stable"
    if score < 5.0:
        return "minor"
    if score < 9.0:
        return "degraded"
    return "major"


def _format_duration(hours: float | None) -> str:
    if hours is None:
        return "n/a"
    total_minutes = max(int(round(hours * 60)), 0)
    days, rem_minutes = divmod(total_minutes, 24 * 60)
    h, m = divmod(rem_minutes, 60)
    if days > 0:
        return f"{days}d {h}h"
    if h > 0:
        return f"{h}h {m}m"
    return f"{m}m"


def _source_freshness(last_item_at: str | None) -> tuple[str, int | None]:
    age_hours = _hours_since(last_item_at)
    if age_hours is None:
        return "unknown", None
    age_minutes = int(round(age_hours * 60))
    if age_minutes <= SOURCE_FRESH_MINUTES_FRESH:
        return "fresh", age_minutes
    if age_minutes <= SOURCE_FRESH_MINUTES_WARM:
        return "warm", age_minutes
    return "stale", age_minutes


def _run_sony_provider_source(
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
) -> SourceRunResult[Any]:
    return run_source_adapter(
        CallableSourceAdapter(
            spec=SourceAdapterSpec(
                service_id="sony",
                adapter_id=adapter_id,
                name=name,
                kind=kind,
                url=url,
                role=role,
                criticality=criticality,
                used_for_scoring=used_for_scoring,
                cache_ttl_seconds=CACHE_TTL_SECONDS,
            ),
            fetch_fn=fetch_fn,
            item_count_fn=item_count_fn,
            last_item_at_fn=last_item_at_fn,
        ),
        utc_now_iso=_utc_now_iso,
        source_freshness=_source_freshness,
        safe_error_message=_safe_error_message,
    )


def _synthesize_statusgator_summary(
    current_status: str,
    reports_24h: int | None,
    incidents: list[dict[str, Any]],
    top_reported_issues: list[dict[str, Any]],
) -> str:
    normalized_status = _normalize_outage_status_text(current_status)
    latest_incident_age_hours = _hours_since(str(incidents[0].get("started_at")) if incidents else None)
    if normalized_status != "unknown" and isinstance(reports_24h, int):
        return (
            f"StatusGator indicates PlayStation Network is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator indicates PlayStation Network is currently {normalized_status}. "
                    f"Most recent listed incident started about {rounded_age_hours}h ago."
                )
            return (
                f"StatusGator indicates PlayStation Network is currently {normalized_status}. "
                f"Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator indicates PlayStation Network is currently {normalized_status}."
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
    summary = f"IsDown indicates PlayStation Network is {status_phrase}."
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


def _sony_statusgator_item_count(payload: Any) -> int | None:
    return len(payload.get("incidents") or []) if isinstance(payload, dict) else 0


def _sony_statusgator_last_item_at(payload: Any) -> str | None:
    # Status index freshness is based on successful fetch time, not incident recency.
    return _utc_now_iso() if isinstance(payload, dict) else None


def _sony_isdown_item_count(payload: Any) -> int | None:
    return len(payload.get("user_reports_24h") or []) if isinstance(payload, dict) else 0


def _sony_isdown_last_item_at(payload: Any) -> str | None:
    return str(payload.get("last_reviewed_at") or "") or None if isinstance(payload, dict) else None


def _sony_region_source_bundle(region_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    raw_events = parse_playstation_region_events(
        region_key,
        payload,
        clean=_clean,
        region_labels=REGION_LABELS,
        utc_now_iso=_utc_now_iso,
    )
    active_events = [event for event in raw_events if _is_active_incident_event(event)]
    latest_item = next((event.get("started_at") for event in raw_events if event.get("started_at")), None)
    latest_active_item = next((event.get("started_at") for event in active_events if event.get("started_at")), None)
    return {
        "raw_events": raw_events,
        "active_events": active_events,
        "latest_item": latest_item,
        "latest_active_item": latest_active_item,
    }


def _sony_region_item_count(bundle: dict[str, Any]) -> int | None:
    raw_events = bundle.get("raw_events")
    return len(raw_events) if isinstance(raw_events, list) else 0


def _sony_region_last_item_at(bundle: dict[str, Any]) -> str | None:
    # Region status JSON is a snapshot endpoint; freshness follows fetch time, not incident recency.
    return _utc_now_iso() if isinstance(bundle, dict) else None


def _run_sony_region_source(*, region_key: str, region_code: str) -> SourceRunResult[dict[str, Any]]:
    url = f"{SONY_REGION_URL}/{region_code}.json"
    return run_source_adapter(
        CallableSourceAdapter(
            spec=SourceAdapterSpec(
                service_id="sony",
                adapter_id=f"psn-region-{region_key}",
                name=f"PlayStation Status {region_code}",
                kind="official-status-region",
                url=url,
                role="official",
                criticality="required",
                used_for_scoring=True,
                cache_ttl_seconds=CACHE_TTL_SECONDS,
            ),
            fetch_fn=lambda: _sony_region_source_bundle(region_key, _request_json(url)),
            item_count_fn=_sony_region_item_count,
            last_item_at_fn=_sony_region_last_item_at,
        ),
        utc_now_iso=_utc_now_iso,
        source_freshness=_source_freshness,
        safe_error_message=_safe_error_message,
    )


def _event_score(event: dict[str, Any]) -> float:
    base = STATUS_BASE_SCORE.get(str(event.get("status_type") or "ok"), 0.0)
    if base <= 0:
        return 0.0

    age_h = _hours_since(event.get("started_at"))
    if age_h is None:
        recency = 0.25
    elif age_h <= 6:
        recency = 1.0
    elif age_h <= 24:
        recency = 0.68
    elif age_h <= 72:
        recency = 0.38
    else:
        recency = 0.15

    scope = str(event.get("scope") or "service")
    if scope == "region":
        scope_weight = 1.45
    elif scope == "country":
        scope_weight = 1.2
    else:
        scope_weight = 1.0

    return base * recency * scope_weight


def _is_active_incident_event(event: dict[str, Any]) -> bool:
    """Sony region feeds can keep long-lived historical rows (for example RU store outages).
    Count only recent non-ok rows as active incidents for current status severity/output.
    """
    status_type = str(event.get("status_type") or "ok")
    if status_type == "ok":
        return False
    age_h = _hours_since(event.get("started_at"))
    if age_h is None:
        return False
    return age_h <= ACTIVE_EVENT_MAX_AGE_HOURS


def _estimate_reports_24h(events: list[dict[str, Any]]) -> int:
    if not events:
        return 0

    recent = []
    medium = []
    for event in events:
        age_h = _hours_since(event.get("started_at"))
        if age_h is None:
            continue
        if age_h <= 24:
            recent.append(event)
        elif age_h <= 72:
            medium.append(event)

    score = 0
    for event in recent:
        status_type = str(event.get("status_type") or "ok")
        if status_type == "outage":
            score += 185
        elif status_type == "degraded":
            score += 115
        elif status_type == "maintenance":
            score += 70
        else:
            score += 22
    for event in medium:
        score += int(round(_event_score(event) * 22))

    if not recent and events:
        score += min(len(events) * 10, 90)
    return max(int(score), 0)


def _build_regions(region_events: dict[str, list[dict[str, Any]]], global_reports_24h: int) -> dict[str, dict[str, Any]]:
    region_rows: dict[str, dict[str, Any]] = {}
    report_seed = global_reports_24h if global_reports_24h > 0 else 1
    for region_key in ("na", "eu", "apac"):
        events = region_events.get(region_key, [])
        score = sum(_event_score(event) for event in events)
        if len(events) <= 1 and not any((_hours_since(item.get("started_at")) or 9999) <= 24 for item in events):
            score = min(score, 2.4)
        reports = _estimate_reports_24h(events)
        weight = max(min(reports / report_seed, 1.0), 0.0) if global_reports_24h > 0 else (1.0 / 3.0)
        region_rows[region_key] = {
            "severity_key": _severity_from_score(score, 1),
            "severity_score": int(round(score)),
            "report_weight": round(weight, 3),
        }
    return region_rows


def _build_official_updates(incidents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates: list[dict[str, Any]] = []
    for incident in incidents[:6]:
        updates.append(
            {
                "title": incident.get("title") or "Status update",
                "url": SONY_STATUS_URL,
                "published_at": incident.get("started_at"),
                "source": "PlayStation Status",
            }
        )
    if not updates:
        updates.append(
            {
                "title": "PlayStation Network status page shows no active widespread incidents.",
                "url": SONY_STATUS_URL,
                "published_at": _utc_now_iso(),
                "source": "PlayStation Status",
            }
        )
    return updates


def _top_reported_issue_label(event: dict[str, Any]) -> str:
    service_name = _clean(event.get("service"))
    country = _clean(event.get("country"))
    region_key = _clean(event.get("region")).lower()
    region_label = REGION_LABELS.get(region_key, region_key.upper() if region_key else "Region")
    status_label = _clean(event.get("status_label")) or _clean(event.get("status_type")) or "Status"

    if service_name:
        subject = service_name
    elif country:
        subject = f"{country} region"
    else:
        subject = region_label
    return f"{subject} - {status_label}"


def _top_issue_priority(event: dict[str, Any]) -> int:
    status_type = str(event.get("status_type") or "ok")
    if status_type == "outage":
        return 3
    if status_type == "degraded":
        return 2
    if status_type == "maintenance":
        return 1
    return 0


def _build_top_reported_issues(
    active_events: list[dict[str, Any]],
    raw_events: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    active_candidates = [
        event for event in active_events if str(event.get("status_type") or "ok") != "ok"
    ]

    mode = "active"
    candidates = active_candidates
    window_hours = ACTIVE_EVENT_MAX_AGE_HOURS

    if not candidates:
        mode = "history"
        window_hours = TOP_ISSUE_HISTORY_MAX_AGE_HOURS
        candidates = []
        for event in raw_events:
            if str(event.get("status_type") or "ok") == "ok":
                continue
            age_h = _hours_since(event.get("started_at"))
            if age_h is None or age_h > TOP_ISSUE_HISTORY_MAX_AGE_HOURS:
                continue
            candidates.append(event)

    grouped: dict[str, dict[str, Any]] = {}
    for event in candidates:
        label = _top_reported_issue_label(event)
        if not label:
            continue
        latest_dt = _parse_iso8601(str(event.get("started_at") or "")) or dt.datetime.min.replace(
            tzinfo=dt.UTC
        )
        bucket = grouped.setdefault(
            label,
            {
                "label": label,
                "count": 0,
                "priority": _top_issue_priority(event),
                "latest_dt": latest_dt,
            },
        )
        bucket["count"] += 1
        bucket["priority"] = max(int(bucket["priority"]), _top_issue_priority(event))
        if latest_dt > bucket["latest_dt"]:
            bucket["latest_dt"] = latest_dt

    rows = sorted(
        grouped.values(),
        key=lambda item: (
            int(item.get("priority") or 0),
            int(item.get("count") or 0),
            item.get("latest_dt") or dt.datetime.min.replace(tzinfo=dt.UTC),
        ),
        reverse=True,
    )

    return (
        [
            {
                "label": str(item.get("label") or "Status event"),
                "count": int(item.get("count") or 0),
            }
            for item in rows[:TOP_REPORTED_ISSUES_LIMIT]
        ],
        {
            "source": "PlayStation Status regional feeds",
            "kind": "official-feed-derived",
            "mode": mode if candidates else "none",
            "window_hours": window_hours,
        },
    )


def _collect_payload() -> dict[str, Any]:
    now_iso = _utc_now_iso()
    all_events: list[dict[str, Any]] = []
    all_raw_events: list[dict[str, Any]] = []
    region_events: dict[str, list[dict[str, Any]]] = {key: [] for key in REGION_ENDPOINTS}
    sources: list[dict[str, Any]] = []
    provider_outage: dict[str, Any] | None = None

    for region_key, region_code in REGION_ENDPOINTS.items():
        result = _run_sony_region_source(region_key=region_key, region_code=region_code)
        source_entry = dict(result.source)
        source_entry["fetched_at"] = now_iso
        if result.ok and result.data:
            raw_events = result.data.get("raw_events") if isinstance(result.data, dict) else []
            active_events = result.data.get("active_events") if isinstance(result.data, dict) else []
            latest_active_item = result.data.get("latest_active_item") if isinstance(result.data, dict) else None
            raw_events = raw_events if isinstance(raw_events, list) else []
            active_events = active_events if isinstance(active_events, list) else []

            region_events[region_key] = active_events
            all_events.extend(active_events)
            all_raw_events.extend(raw_events)

            source_entry.update(
                {
                    "active_item_count": len(active_events),
                    "archived_item_count": max(len(raw_events) - len(active_events), 0),
                    "last_active_item_at": latest_active_item,
                }
            )
        else:
            region_events[region_key] = []
        sources.append(source_entry)

    statusgator_run = _run_sony_provider_source(
        adapter_id="statusgator_playstation",
        name="StatusGator",
        kind="outage-index",
        url=STATUSGATOR_URL,
        role="provider",
        criticality="supporting",
        used_for_scoring=True,
        fetch_fn=fetch_statusgator_outages,
        item_count_fn=_sony_statusgator_item_count,
        last_item_at_fn=_sony_statusgator_last_item_at,
    )
    sources.append(statusgator_run.source)
    if statusgator_run.ok and isinstance(statusgator_run.data, dict):
        provider_outage = statusgator_run.data

    isdown_run = _run_sony_provider_source(
        adapter_id="isdown_playstation_network",
        name="IsDown (PlayStation Network)",
        kind="outage-index-alt",
        url=ISDOWN_STATUS_URL,
        role="provider",
        criticality="supporting",
        used_for_scoring=True,
        fetch_fn=fetch_isdown_outages,
        item_count_fn=_sony_isdown_item_count,
        last_item_at_fn=_sony_isdown_last_item_at,
    )
    sources.append(isdown_run.source)
    isdown_outage = isdown_run.data if isdown_run.ok and isinstance(isdown_run.data, dict) else None
    provider_outage = _merge_secondary_outage_signal(provider_outage, isdown_outage)

    all_events.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    all_raw_events.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    source_total = len(sources)
    source_ok = sum(1 for source in sources if source.get("ok"))
    required_total = sum(1 for source in sources if str(source.get("criticality") or "").lower() == "required")
    required_ok = sum(
        1
        for source in sources
        if str(source.get("criticality") or "").lower() == "required" and bool(source.get("ok"))
    )
    official_unavailable = required_total > 0 and required_ok == 0

    if source_ok <= 0:
        health = "error"
    elif source_ok < source_total:
        health = "degraded"
    else:
        health = "ok"

    global_score = sum(_event_score(event) for event in all_events)
    recent_events = [event for event in all_events if (_hours_since(event.get("started_at")) or math.inf) <= 24]
    if len(all_events) <= 1 and not recent_events:
        global_score = min(global_score, 2.4)
    global_reports_24h = _estimate_reports_24h(all_events)
    provider_reports_24h = (
        int(provider_outage.get("reports_24h"))
        if isinstance(provider_outage, dict) and isinstance(provider_outage.get("reports_24h"), int)
        else None
    )
    if global_reports_24h <= 0 and provider_reports_24h is not None:
        global_reports_24h = provider_reports_24h

    severity_key = _severity_from_score(global_score, source_total)
    if source_ok <= 0:
        severity_key = "unknown"
        global_score = 0.0
    elif official_unavailable:
        provider_status = _normalize_outage_status_text(
            provider_outage.get("current_status") if isinstance(provider_outage, dict) else None
        )
        if provider_status == "major outage":
            severity_key = "major"
            global_score = max(global_score, 9.1)
        elif provider_status == "degraded":
            severity_key = "degraded"
            global_score = max(global_score, 5.1)
        elif severity_key == "stable":
            severity_key = "minor"
            global_score = max(global_score, 2.6)

    incidents = []
    for event in all_events[:25]:
        started_at = event.get("started_at")
        incidents.append(
            {
                "title": event.get("title"),
                "started_at": started_at,
                "duration": _format_duration(_hours_since(started_at)),
                "acknowledgement": f"{event.get('status_label')} | {REGION_LABELS.get(event.get('region'), str(event.get('region')).upper())}",
            }
        )

    reports = [
        {
            "title": incident.get("title"),
            "url": SONY_STATUS_URL,
            "source": "PlayStation Status",
            "meta": incident.get("acknowledgement"),
            "published_at": incident.get("started_at"),
        }
        for incident in incidents[:12]
    ]

    known_resources = [
        {
            "title": "PlayStation Network status page",
            "url": SONY_STATUS_URL,
            "source": "Official",
            "meta": "Sony",
            "published_at": now_iso,
        },
        {
            "title": "PlayStation Repairs and support",
            "url": "https://www.playstation.com/repairs",
            "source": "Official",
            "meta": "Sony Support",
            "published_at": now_iso,
        },
        {
            "title": "Ask PlayStation support on X",
            "url": "https://x.com/AskPlayStation",
            "source": "Official",
            "meta": "Social support",
            "published_at": now_iso,
        },
        {
            "title": "PlayStation status corroboration (StatusGator)",
            "url": STATUSGATOR_URL,
            "source": "Provider",
            "meta": "Corroboration",
            "published_at": now_iso,
        },
        {
            "title": "PlayStation status corroboration (IsDown)",
            "url": ISDOWN_STATUS_URL,
            "source": "Provider",
            "meta": "Corroboration",
            "published_at": now_iso,
        },
    ]

    updates = _build_official_updates(incidents)
    top_reported_issues, top_reported_issues_meta = _build_top_reported_issues(
        all_events, all_raw_events
    )
    provider_top_issues = (
        [item for item in (provider_outage.get("top_reported_issues") or []) if isinstance(item, dict)]
        if isinstance(provider_outage, dict)
        else []
    )
    if not top_reported_issues and provider_top_issues:
        top_reported_issues = provider_top_issues[:TOP_REPORTED_ISSUES_LIMIT]
        top_reported_issues_meta = {
            "source": str(provider_outage.get("source") or "Provider corroboration"),
            "kind": "provider-derived",
            "mode": "fallback",
        }

    if not incidents:
        outage_summary = "PlayStation Network currently reports no widespread service issues across monitored regions."
    else:
        affected_regions = sorted({REGION_LABELS.get(event.get("region"), str(event.get("region")).upper()) for event in all_events})
        outage_summary = (
            f"PlayStation Network shows {len(incidents)} active status event(s) across monitored regions. "
            f"Affected region scope: {', '.join(affected_regions)}."
        )
    if official_unavailable and isinstance(provider_outage, dict):
        provider_summary = _clean(provider_outage.get("summary"))
        if provider_summary:
            outage_summary = (
                "Official PlayStation regional feeds are temporarily unavailable. "
                f"{provider_summary}"
            )

    regions = _build_regions(region_events, global_reports_24h)
    safeguards = {
        "recency_decay": True,
        "cross_source_guard": True,
        "low_volume_guard": global_reports_24h < 160,
        "operational_dampening": not incidents,
        "active_event_max_age_hours": ACTIVE_EVENT_MAX_AGE_HOURS,
        "archived_events_ignored": max(len(all_raw_events) - len(all_events), 0),
        "official_feed_unavailable": official_unavailable,
    }
    outage_current_status = "operational" if not incidents else ("major outage" if severity_key == "major" else "degraded")
    if official_unavailable and isinstance(provider_outage, dict):
        provider_status = _normalize_outage_status_text(provider_outage.get("current_status"))
        if provider_status != "unknown":
            outage_current_status = provider_status

    return {
        "generated_at": now_iso,
        "health": health,
        "analytics": {
            "severity_key": severity_key,
            "severity_score": int(round(global_score)),
            "source_ok_count": source_ok,
            "source_total_count": source_total,
            "model_version": "sony-1.0",
            "report_weight": round(min(global_reports_24h / 1000.0, 1.0), 3) if global_reports_24h > 0 else 0.0,
            "safeguards": safeguards,
        },
        "regions": regions,
        "official": {
            "summary": updates[0].get("title"),
            "last_statement_at": updates[0].get("published_at"),
            "updates": updates,
        },
        "outage": {
            "source": "PlayStation Status",
            "url": SONY_STATUS_URL,
            "summary": outage_summary,
            "current_status": outage_current_status,
            "reports_24h": global_reports_24h,
            "incidents": incidents,
            "top_reported_issues": top_reported_issues,
            "top_reported_issues_meta": top_reported_issues_meta,
            "secondary_sources": provider_outage.get("secondary_sources", []) if isinstance(provider_outage, dict) else [],
        },
        "reports": reports,
        "known_resources": known_resources,
        "news": updates[:6],
        "social": [],
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
