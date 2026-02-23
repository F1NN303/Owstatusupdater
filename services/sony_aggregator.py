from __future__ import annotations

import datetime as dt
import html as html_lib
import math
import re
import threading
import time
from typing import Any

import requests

UA = {"User-Agent": "Sony-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

SONY_STATUS_ROOT = "https://status.playstation.com"
SONY_STATUS_URL = f"{SONY_STATUS_ROOT}/"
SONY_REGION_URL = f"{SONY_STATUS_ROOT}/data/statuses/region"

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


def _status_type_key(value: str | None) -> str:
    text = _clean(value).lower()
    if "outage" in text:
        return "outage"
    if "degrad" in text:
        return "degraded"
    if "maint" in text:
        return "maintenance"
    return "ok"


def _pick_message(status: dict[str, Any]) -> str:
    raw = status.get("message")
    if not isinstance(raw, dict):
        return ""
    messages = raw.get("messages")
    if not isinstance(messages, dict):
        return ""
    preferred = (
        "en-US",
        "en-GB",
        "en",
        "de-DE",
        "de",
        "fr-FR",
        "es-ES",
        "ja-JP",
    )
    for key in preferred:
        text = _clean(messages.get(key))
        if text:
            return text
    for value in messages.values():
        text = _clean(value)
        if text:
            return text
    return ""


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


def _event_timestamp(status: dict[str, Any]) -> str:
    for field in ("startDate", "modifiedDate", "createdDate"):
        raw = _clean(status.get(field))
        if raw:
            return raw
    return _utc_now_iso()


def _event_title(scope: str, region_key: str, country: str | None, service_name: str | None, status: dict[str, Any]) -> str:
    status_type = _clean(status.get("statusType")) or "Status update"
    message = _pick_message(status)
    region_label = REGION_LABELS.get(region_key, region_key.upper())
    if scope == "service" and service_name:
        base = f"{service_name}: {status_type}"
    elif scope == "country" and country:
        base = f"{country} region: {status_type}"
    else:
        base = f"{region_label}: {status_type}"
    if message:
        return f"{base} - {message}"
    return base


def _extract_region_events(region_key: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    region_statuses = payload.get("status") if isinstance(payload.get("status"), list) else []
    countries = payload.get("countries") if isinstance(payload.get("countries"), list) else []

    for status in region_statuses:
        if not isinstance(status, dict):
            continue
        status_type = _status_type_key(status.get("statusType"))
        events.append(
            {
                "event_id": _clean(status.get("statusId")) or f"{region_key}-region-{len(events)}",
                "scope": "region",
                "region": region_key,
                "country": None,
                "service": None,
                "status_type": status_type,
                "status_label": _clean(status.get("statusType")) or "Status",
                "started_at": _event_timestamp(status),
                "title": _event_title("region", region_key, None, None, status),
            }
        )

    for country in countries:
        if not isinstance(country, dict):
            continue
        country_code = _clean(country.get("countryCode"))
        country_statuses = country.get("status") if isinstance(country.get("status"), list) else []
        services = country.get("services") if isinstance(country.get("services"), list) else []

        for status in country_statuses:
            if not isinstance(status, dict):
                continue
            status_type = _status_type_key(status.get("statusType"))
            events.append(
                {
                    "event_id": _clean(status.get("statusId")) or f"{region_key}-{country_code}-country-{len(events)}",
                    "scope": "country",
                    "region": region_key,
                    "country": country_code,
                    "service": None,
                    "status_type": status_type,
                    "status_label": _clean(status.get("statusType")) or "Status",
                    "started_at": _event_timestamp(status),
                    "title": _event_title("country", region_key, country_code, None, status),
                }
            )

        for service in services:
            if not isinstance(service, dict):
                continue
            service_name = _clean(service.get("serviceName")) or _clean(service.get("serviceId")) or "Service"
            service_statuses = service.get("status") if isinstance(service.get("status"), list) else []
            for status in service_statuses:
                if not isinstance(status, dict):
                    continue
                status_type = _status_type_key(status.get("statusType"))
                events.append(
                    {
                        "event_id": _clean(status.get("statusId")) or f"{region_key}-{country_code}-{service_name}-{len(events)}",
                        "scope": "service",
                        "region": region_key,
                        "country": country_code,
                        "service": service_name,
                        "status_type": status_type,
                        "status_label": _clean(status.get("statusType")) or "Status",
                        "started_at": _event_timestamp(status),
                        "title": _event_title("service", region_key, country_code, service_name, status),
                    }
                )

    deduped: dict[tuple[str, str, str | None, str | None], dict[str, Any]] = {}
    for event in events:
        key = (event["event_id"], event["scope"], event.get("country"), event.get("service"))
        deduped[key] = event
    out = list(deduped.values())
    out.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    return out


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


def _collect_payload() -> dict[str, Any]:
    now_iso = _utc_now_iso()
    all_events: list[dict[str, Any]] = []
    all_raw_events: list[dict[str, Any]] = []
    region_events: dict[str, list[dict[str, Any]]] = {key: [] for key in REGION_ENDPOINTS}
    sources: list[dict[str, Any]] = []

    for region_key, region_code in REGION_ENDPOINTS.items():
        started = time.perf_counter()
        url = f"{SONY_REGION_URL}/{region_code}.json"
        try:
            payload = _request_json(url)
            raw_events = _extract_region_events(region_key, payload)
            active_events = [event for event in raw_events if _is_active_incident_event(event)]

            region_events[region_key] = active_events
            all_events.extend(active_events)
            all_raw_events.extend(raw_events)

            latest_item = next((event.get("started_at") for event in raw_events if event.get("started_at")), None)
            latest_active_item = next((event.get("started_at") for event in active_events if event.get("started_at")), None)
            freshness, age_minutes = _source_freshness(latest_item)
            sources.append(
                {
                    "name": f"PlayStation Status {region_code}",
                    "kind": "official-status-region",
                    "url": url,
                    "ok": True,
                    "error": None,
                    "item_count": len(raw_events),
                    "active_item_count": len(active_events),
                    "archived_item_count": max(len(raw_events) - len(active_events), 0),
                    "last_item_at": latest_item,
                    "last_active_item_at": latest_active_item,
                    "freshness": freshness,
                    "age_minutes": age_minutes,
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "fetched_at": now_iso,
                }
            )
        except Exception as exc:  # pragma: no cover
            region_events[region_key] = []
            sources.append(
                {
                    "name": f"PlayStation Status {region_code}",
                    "kind": "official-status-region",
                    "url": url,
                    "ok": False,
                    "error": _clean(str(exc)) or "request failed",
                    "item_count": 0,
                    "last_item_at": None,
                    "freshness": "unknown",
                    "age_minutes": None,
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "fetched_at": now_iso,
                }
            )

    all_events.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    all_raw_events.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    source_total = len(sources)
    source_ok = sum(1 for source in sources if source.get("ok"))

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
    severity_key = _severity_from_score(global_score, source_total)
    if source_ok <= 0:
        severity_key = "unknown"
        global_score = 0.0

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
    ]

    updates = _build_official_updates(incidents)
    if not incidents:
        outage_summary = "PlayStation Network currently reports no widespread service issues across monitored regions."
    else:
        affected_regions = sorted({REGION_LABELS.get(event.get("region"), str(event.get("region")).upper()) for event in all_events})
        outage_summary = (
            f"PlayStation Network shows {len(incidents)} active status event(s) across monitored regions. "
            f"Affected region scope: {', '.join(affected_regions)}."
        )

    regions = _build_regions(region_events, global_reports_24h)
    safeguards = {
        "recency_decay": True,
        "cross_source_guard": True,
        "low_volume_guard": global_reports_24h < 160,
        "operational_dampening": not incidents,
        "active_event_max_age_hours": ACTIVE_EVENT_MAX_AGE_HOURS,
        "archived_events_ignored": max(len(all_raw_events) - len(all_events), 0),
    }

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
            "reports_24h": global_reports_24h,
            "incidents": incidents,
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
