from __future__ import annotations

import datetime as dt
import json
import re
import threading
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from services.ow_aggregator import (
    _build_region_signals,
    _calculate_severity,
    _clean,
    _dedupe_by_url,
    _latest_timestamp,
    _merge_secondary_outage_signal,
    _normalize_outage_status_text,
    _parse_statusgator_service_health_series,
    _parse_statusgator_top_reported_issues,
    _safe_error_message,
    _sort_by_datetime,
    _source_freshness,
)

UA = {"User-Agent": "M365-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

STATUSGATOR_URL = "https://statusgator.com/services/microsoft-365-suite"
ISDOWN_STATUS_URL = "https://isdown.app/status/microsoft365"
MICROSOFT_PUBLIC_STATUS_URL = "https://status.cloud.microsoft/"
X_MIRROR_URL = "https://r.jina.ai/http://x.com/MSFT365Status"

MICROSOFT_SERVICE_HEALTH_DOCS_URL = (
    "https://learn.microsoft.com/en-us/microsoft-365/enterprise/view-service-health?view=o365-worldwide"
)
MICROSOFT_GRAPH_COMMUNICATIONS_DOCS_URL = (
    "https://learn.microsoft.com/en-us/graph/service-communications-concept-overview"
)

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _request_text(url: str, timeout: int = REQUEST_TIMEOUT) -> str:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.text


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


def _synthesize_statusgator_summary(
    current_status: str,
    reports_24h: int | None,
    incidents: list[dict[str, Any]],
    top_reported_issues: list[dict[str, Any]],
) -> str:
    normalized_status = _normalize_outage_status_text(current_status)
    latest_incident = incidents[0] if incidents else None
    latest_incident_age_hours = _hours_since(
        str(latest_incident.get("started_at")) if isinstance(latest_incident, dict) else None
    )
    if normalized_status != "unknown" and isinstance(reports_24h, int):
        return (
            f"StatusGator indicates Microsoft 365 is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator service-health trend indicates Microsoft 365 is currently "
                    f"{normalized_status}. Most recent listed incident started about "
                    f"{rounded_age_hours}h ago."
                )
            return (
                f"StatusGator service-health trend indicates Microsoft 365 is currently "
                f"{normalized_status}. Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator service-health trend indicates Microsoft 365 is currently {normalized_status}."
    if incidents:
        latest_title = _clean(str(incidents[0].get("title") or "Recent incident listed"))
        if isinstance(reports_24h, int):
            return (
                f"StatusGator incident table is available. Latest listed incident: {latest_title}. "
                f"{reports_24h} user-submitted reports were recorded in the past 24 hours."
            )
        return f"StatusGator incident table is available. Latest listed incident: {latest_title}."
    if top_reported_issues:
        top_label = _clean(str(top_reported_issues[0].get("label") or "Community issue signal"))
        return f"StatusGator community issue labels are available (top label: {top_label})."
    return "Status summary unavailable."


def fetch_statusgator_outages() -> dict[str, Any]:
    html = _request_text(STATUSGATOR_URL)
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))
    service_health_24h, service_health_24h_meta = _parse_statusgator_service_health_series(html)

    summary_match = re.search(
        r"StatusGator reports that .*? is currently .*?past 24 hours\.",
        page_text,
        flags=re.IGNORECASE,
    )
    summary = _clean(summary_match.group(0)) if summary_match else "Status summary unavailable."

    status_match = re.search(r"currently\s+([a-zA-Z ]+)\.", summary, flags=re.IGNORECASE)
    current_status = _clean(status_match.group(1)).lower() if status_match else "unknown"
    if current_status == "unknown" and service_health_24h:
        current_status = _normalize_outage_status_text(service_health_24h[-1].get("status_label"))

    reports_match = re.search(
        r"There have been\s+([\d,]+)\s+user-submitted reports of outages in the past 24 hours",
        summary,
        flags=re.IGNORECASE,
    )
    reports_24h = int(reports_match.group(1).replace(",", "")) if reports_match else None

    incidents: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None, str]] = set()
    for row in soup.select("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue
        title_holder = cells[0].find("span")
        title = _clean(title_holder.get_text(" ", strip=True) if title_holder else cells[0].get_text(" ", strip=True))
        duration = _clean(cells[1].get_text(" ", strip=True))
        time_tag = cells[2].find("time")
        started_at = time_tag.get("datetime") if time_tag else None
        acknowledgement = _clean(cells[3].get_text(" ", strip=True)) if len(cells) > 3 else ""
        if not title or not started_at:
            continue
        key = (title, started_at, duration)
        if key in seen:
            continue
        seen.add(key)
        incidents.append(
            {
                "title": title,
                "started_at": started_at,
                "duration": duration,
                "acknowledgement": acknowledgement or None,
            }
        )
        if len(incidents) >= 12:
            break

    incidents = _sort_by_datetime(incidents, field="started_at")[:8]
    top_reported_issues = _parse_statusgator_top_reported_issues(soup)
    if "summary unavailable" in summary.lower():
        summary = _synthesize_statusgator_summary(current_status, reports_24h, incidents, top_reported_issues)

    return {
        "source": "StatusGator",
        "source_type": "Downdetector-like",
        "url": STATUSGATOR_URL,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": incidents,
        "top_reported_issues": top_reported_issues,
        "top_reported_issues_meta": {"source": "StatusGator", "kind": "community-labels"},
        "service_health_24h": service_health_24h,
        "service_health_24h_meta": service_health_24h_meta,
    }


def _extract_isdown_status_text(page_text: str) -> tuple[str, str]:
    summary_match = re.search(
        r"What is .*? status right now\?\s+.*? is ([^.]+)\.",
        page_text,
        flags=re.IGNORECASE,
    )
    if not summary_match:
        return "Status summary unavailable.", "unknown"
    status_phrase = _clean(summary_match.group(1))
    summary = f"IsDown indicates Microsoft 365 is {status_phrase}."
    lowered = status_phrase.lower()
    if "operational" in lowered:
        current_status = "operational"
    elif any(token in lowered for token in ("outage", "down", "offline")):
        current_status = "major outage"
    elif any(token in lowered for token in ("degraded", "issue", "maintenance")):
        current_status = "degraded"
    else:
        current_status = lowered or "unknown"
    return summary, current_status


def fetch_isdown_outages() -> dict[str, Any]:
    html = _request_text(ISDOWN_STATUS_URL)
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))

    chart_match = re.search(
        r"UserReportsChart\.create\('myChart',\s*(\[[\s\S]*?\])\s*,",
        html,
        flags=re.IGNORECASE,
    )
    chart_points: list[dict[str, Any]] = []
    if chart_match:
        try:
            raw_chart = json.loads(chart_match.group(1))
        except json.JSONDecodeError:
            raw_chart = []
        for row in raw_chart if isinstance(raw_chart, list) else []:
            if not isinstance(row, dict):
                continue
            label = _clean(str(row.get("x") or ""))
            try:
                count = int(float(row.get("y") or 0))
            except (TypeError, ValueError):
                continue
            if not label:
                continue
            chart_points.append({"label": label, "count": max(count, 0)})

    reports_24h = sum(point.get("count", 0) for point in chart_points) if chart_points else None
    last_reviewed_match = re.search(r'"lastReviewed":"([^"]+)"', html)
    last_reviewed_at = last_reviewed_match.group(1) if last_reviewed_match else None
    summary, current_status = _extract_isdown_status_text(page_text)

    return {
        "source": "IsDown",
        "source_type": "Downdetector-like",
        "url": ISDOWN_STATUS_URL,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": [],
        "top_reported_issues": [],
        "user_reports_24h": chart_points[:120],
        "user_reports_24h_meta": {
            "source": "IsDown",
            "kind": "user-reports-chart",
            "window_hours": 24,
            "sample_count": len(chart_points),
            "interval_minutes": 20 if chart_points else None,
            "last_reviewed_at": last_reviewed_at,
        },
        "last_reviewed_at": last_reviewed_at,
    }


def fetch_microsoft_public_status() -> dict[str, Any]:
    html = _request_text(MICROSOFT_PUBLIC_STATUS_URL)
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))
    title = _clean(soup.title.get_text(" ", strip=True) if soup.title else "")
    checked_at = _utc_now_iso()

    lowered = page_text.lower()
    current_status = "unknown"
    if any(token in lowered for token in ("all services are healthy", "all services are up and running")):
        current_status = "operational"
    elif any(token in lowered for token in ("major outage", "widespread outage", "service down")):
        current_status = "major outage"
    elif any(token in lowered for token in ("degraded", "advisory", "incident", "maintenance", "issue")):
        current_status = "degraded"

    if "javascript" in lowered and any(token in lowered for token in ("enable", "required", "unsupported")):
        summary = "Microsoft public status page is reachable. Detailed content appears to be JavaScript-rendered."
    elif title:
        summary = f"Microsoft public status page is reachable ({title})."
    else:
        summary = "Microsoft public status page is reachable."

    updates = [
        {
            "title": summary,
            "url": MICROSOFT_PUBLIC_STATUS_URL,
            "published_at": checked_at,
            "source": "Microsoft Public Status",
            "meta": title or None,
        }
    ]
    return {
        "source": "Microsoft Public Status",
        "url": MICROSOFT_PUBLIC_STATUS_URL,
        "summary": summary,
        "current_status": current_status,
        "checked_at": checked_at,
        "updates": updates,
    }


def fetch_x_updates(limit: int = 4) -> list[dict[str, Any]]:
    text = _request_text(X_MIRROR_URL)
    ids = re.findall(r"https://x\.com/MSFT365Status/status/(\d+)", text, flags=re.IGNORECASE)
    unique_ids: list[str] = []
    seen: set[str] = set()
    for status_id in ids:
        if status_id in seen:
            continue
        seen.add(status_id)
        unique_ids.append(status_id)
        if len(unique_ids) >= limit:
            break

    return [
        {
            "title": "View latest Microsoft 365 status post on X",
            "url": f"https://x.com/MSFT365Status/status/{status_id}",
            "published_at": None,
            "source": "X - MSFT365Status (mirror)",
            "meta": "Mirror feed, may be delayed",
        }
        for status_id in unique_ids
    ]


def _build_official_block(
    official_status_updates: list[dict[str, Any]],
    social_updates: list[dict[str, Any]],
) -> dict[str, Any]:
    updates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for item in _sort_by_datetime(official_status_updates, field="published_at"):
        url = str(item.get("url") or "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        updates.append(
            {
                "title": _clean(item.get("title")),
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "Microsoft Public Status",
                "channel": "official-status-page",
                "meta": item.get("meta"),
            }
        )

    for item in social_updates:
        url = str(item.get("url") or "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        updates.append(
            {
                "title": _clean(item.get("title")) or "Microsoft 365 status post",
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "X - MSFT365Status (mirror)",
                "channel": "official-social",
                "meta": item.get("meta"),
            }
        )

    updates = _sort_by_datetime(updates, field="published_at")[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official status updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _collect_payload() -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    official_status: dict[str, Any] | None = None
    social: list[dict[str, Any]] = []
    isdown_outage: dict[str, Any] | None = None

    started = time.perf_counter()
    try:
        outage = fetch_statusgator_outages()
        last_item_at = _latest_timestamp(outage.get("incidents") or [], "started_at")
        if not last_item_at and isinstance(outage.get("service_health_24h_meta"), dict):
            last_item_at = outage["service_health_24h_meta"].get("last_sample_at")
        freshness, age_minutes = _source_freshness(last_item_at)
        sources.append(
            {
                "name": "StatusGator",
                "kind": "outage-index",
                "url": STATUSGATOR_URL,
                "ok": True,
                "error": None,
                "item_count": len(outage.get("incidents") or []),
                "last_item_at": last_item_at,
                "freshness": freshness,
                "age_minutes": age_minutes,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )
    except Exception as exc:  # pragma: no cover
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
        sources.append(
            {
                "name": "StatusGator",
                "kind": "outage-index",
                "url": STATUSGATOR_URL,
                "ok": False,
                "error": _safe_error_message(exc),
                "item_count": 0,
                "last_item_at": None,
                "freshness": "unknown",
                "age_minutes": None,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )

    started = time.perf_counter()
    try:
        isdown_outage = fetch_isdown_outages()
        last_item_at = isdown_outage.get("last_reviewed_at")
        freshness, age_minutes = _source_freshness(last_item_at)
        sources.append(
            {
                "name": "IsDown",
                "kind": "outage-index-alt",
                "url": ISDOWN_STATUS_URL,
                "ok": True,
                "error": None,
                "item_count": len(isdown_outage.get("user_reports_24h") or []),
                "last_item_at": last_item_at,
                "freshness": freshness,
                "age_minutes": age_minutes,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )
    except Exception as exc:  # pragma: no cover
        sources.append(
            {
                "name": "IsDown",
                "kind": "outage-index-alt",
                "url": ISDOWN_STATUS_URL,
                "ok": False,
                "error": _safe_error_message(exc),
                "item_count": 0,
                "last_item_at": None,
                "freshness": "unknown",
                "age_minutes": None,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )

    outage = _merge_secondary_outage_signal(outage, isdown_outage)

    started = time.perf_counter()
    try:
        official_status = fetch_microsoft_public_status()
        last_item_at = official_status.get("checked_at")
        freshness, age_minutes = _source_freshness(last_item_at)
        sources.append(
            {
                "name": "Microsoft Public Status",
                "kind": "official-status-page",
                "url": MICROSOFT_PUBLIC_STATUS_URL,
                "ok": True,
                "error": None,
                "item_count": len(official_status.get("updates") or []),
                "last_item_at": last_item_at,
                "freshness": freshness,
                "age_minutes": age_minutes,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )
    except Exception as exc:  # pragma: no cover
        sources.append(
            {
                "name": "Microsoft Public Status",
                "kind": "official-status-page",
                "url": MICROSOFT_PUBLIC_STATUS_URL,
                "ok": False,
                "error": _safe_error_message(exc),
                "item_count": 0,
                "last_item_at": None,
                "freshness": "unknown",
                "age_minutes": None,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )

    started = time.perf_counter()
    try:
        social = fetch_x_updates()
        last_item_at = _latest_timestamp(social, "published_at")
        freshness, age_minutes = _source_freshness(last_item_at)
        sources.append(
            {
                "name": "X mirror feed (MSFT365Status)",
                "kind": "social-mirror",
                "url": X_MIRROR_URL,
                "ok": True,
                "error": None,
                "item_count": len(social),
                "last_item_at": last_item_at,
                "freshness": freshness,
                "age_minutes": age_minutes,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )
    except Exception as exc:  # pragma: no cover
        sources.append(
            {
                "name": "X mirror feed (MSFT365Status)",
                "kind": "social-mirror",
                "url": X_MIRROR_URL,
                "ok": False,
                "error": _safe_error_message(exc),
                "item_count": 0,
                "last_item_at": None,
                "freshness": "unknown",
                "age_minutes": None,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "fetched_at": _utc_now_iso(),
            }
        )

    if official_status and _normalize_outage_status_text(outage.get("current_status")) == "unknown":
        official_status_text = _normalize_outage_status_text(official_status.get("current_status"))
        if official_status_text != "unknown":
            outage["current_status"] = official_status_text
    if official_status and "summary unavailable" in _clean(outage.get("summary")).lower():
        outage["summary"] = official_status.get("summary") or outage.get("summary")
        outage["summary_origin"] = "Microsoft Public Status"

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
            # Keep URLs unique per incident so report rows are not collapsed by _dedupe_by_url.
            "url": (
                f"{outage.get('url') or STATUSGATOR_URL}#"
                f"{(incident.get('started_at') or 'incident')}"
            ),
            "published_at": incident.get("started_at"),
            "source": "StatusGator",
            "meta": incident.get("acknowledgement") or incident.get("duration"),
        }
        for incident in (outage.get("incidents") or [])
    ]
    reports = _sort_by_datetime(_dedupe_by_url(reports), field="published_at")[:12]

    official_status_updates = (
        [item for item in (official_status.get("updates") or []) if isinstance(item, dict)]
        if official_status
        else []
    )
    news = _sort_by_datetime(_dedupe_by_url(official_status_updates), field="published_at")[:6]
    official = _build_official_block(official_status_updates, social)

    analytics = _calculate_severity(outage, sources, health, reports, news, social)
    analytics["model_version"] = "m365-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "Microsoft 365 public service status page",
            "url": MICROSOFT_PUBLIC_STATUS_URL,
            "source": "Official",
            "meta": "Microsoft",
            "published_at": generated_at,
        },
        {
            "title": "Microsoft 365 service health (admin center guide)",
            "url": MICROSOFT_SERVICE_HEALTH_DOCS_URL,
            "source": "Official",
            "meta": "Microsoft Learn",
            "published_at": generated_at,
        },
        {
            "title": "Microsoft Graph service communications overview",
            "url": MICROSOFT_GRAPH_COMMUNICATIONS_DOCS_URL,
            "source": "Official",
            "meta": "Microsoft Learn",
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
        "social": social[:6],
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
