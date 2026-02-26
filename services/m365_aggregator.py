from __future__ import annotations

import datetime as dt
import json
import os
import re
import threading
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from services.core.shared import (
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
MICROSOFT_GRAPH_API_ROOT = "https://graph.microsoft.com/v1.0"
MICROSOFT_GRAPH_TOKEN_SCOPE = "https://graph.microsoft.com/.default"
MICROSOFT_GRAPH_TOKEN_URL_TMPL = (
    "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
)
MICROSOFT_ADMIN_SERVICE_HEALTH_URL = "https://admin.microsoft.com/Adminportal/Home#/servicehealth"

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


def _read_env_first(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return ""


def _graph_credentials_from_env() -> tuple[str, str, str] | None:
    tenant_id = _read_env_first("M365_GRAPH_TENANT_ID", "MICROSOFT_GRAPH_TENANT_ID")
    client_id = _read_env_first("M365_GRAPH_CLIENT_ID", "MICROSOFT_GRAPH_CLIENT_ID")
    client_secret = _read_env_first("M365_GRAPH_CLIENT_SECRET", "MICROSOFT_GRAPH_CLIENT_SECRET")
    if tenant_id and client_id and client_secret:
        return tenant_id, client_id, client_secret
    return None


def _request_json(
    url: str,
    *,
    timeout: int = REQUEST_TIMEOUT,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
) -> Any:
    response = requests.get(url, timeout=timeout, headers=headers or UA, params=params)
    response.raise_for_status()
    return response.json()


def _post_form_json(
    url: str,
    *,
    data: dict[str, str],
    timeout: int = REQUEST_TIMEOUT,
    headers: dict[str, str] | None = None,
) -> Any:
    response = requests.post(url, timeout=timeout, data=data, headers=headers or {})
    response.raise_for_status()
    return response.json()


def _graph_token(credentials: tuple[str, str, str]) -> str:
    tenant_id, client_id, client_secret = credentials
    token_url = MICROSOFT_GRAPH_TOKEN_URL_TMPL.format(tenant_id=tenant_id)
    payload = _post_form_json(
        token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": MICROSOFT_GRAPH_TOKEN_SCOPE,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise RuntimeError("Microsoft Graph token response did not contain access_token")
    return access_token


def _graph_get_collection(
    path: str,
    access_token: str,
    *,
    top: int | None = None,
    max_pages: int = 3,
) -> list[dict[str, Any]]:
    url = f"{MICROSOFT_GRAPH_API_ROOT}{path}"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    params: dict[str, Any] | None = {"$top": top} if isinstance(top, int) and top > 0 else None
    items: list[dict[str, Any]] = []

    for _ in range(max_pages):
        payload = _request_json(url, headers=headers, params=params)
        params = None
        if isinstance(payload, dict):
            raw_items = payload.get("value")
            if isinstance(raw_items, list):
                for item in raw_items:
                    if isinstance(item, dict):
                        items.append(item)
            next_link = payload.get("@odata.nextLink")
            if isinstance(next_link, str) and next_link.strip():
                url = next_link.strip()
                continue
        break

    return items


def _graph_status_token(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _graph_status_to_outage_status(value: Any) -> str:
    token = _graph_status_token(value)
    if not token:
        return "unknown"
    if token in {
        "serviceoperational",
        "servicerestored",
        "verificationcompleted",
        "postincidentreviewpublished",
        "falsepositive",
    }:
        return "operational"
    if token in {"serviceinterruption"}:
        return "major outage"
    if token in {
        "investigating",
        "servicedegradation",
        "restoringservice",
        "extendedrecovery",
        "advisory",
        "servicewarning",
        "informationavailable",
        "serviceavailablewithissues",
        "serviceissue",
    }:
        return "degraded"
    normalized = _normalize_outage_status_text(str(value or ""))
    return normalized if normalized != "unknown" else "unknown"


def _graph_issue_is_active(issue: dict[str, Any]) -> bool:
    if bool(issue.get("isResolved")):
        return False
    if issue.get("endDateTime"):
        return False
    status_token = _graph_status_token(issue.get("status"))
    if status_token in {
        "servicerestored",
        "verificationcompleted",
        "postincidentreviewpublished",
        "falsepositive",
        "resolved",
    }:
        return False
    return True


def _format_human_duration(started_at: str | None, ended_at: str | None) -> str | None:
    start_dt = _parse_iso8601(started_at)
    end_dt = _parse_iso8601(ended_at)
    if not start_dt:
        return None
    if not end_dt:
        return "ongoing"
    total_minutes = max(int((end_dt - start_dt).total_seconds() // 60), 0)
    days, rem_minutes = divmod(total_minutes, 60 * 24)
    hours, minutes = divmod(rem_minutes, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes and len(parts) < 2:
        parts.append(f"{minutes}m")
    if not parts:
        parts.append("0m")
    return " ".join(parts[:3])


def _graph_issue_title(issue: dict[str, Any]) -> str:
    title = _clean(issue.get("title"))
    if title:
        return title
    service = _clean(issue.get("service")) or "Microsoft 365"
    feature = _clean(issue.get("feature"))
    status = _clean(issue.get("status")) or "issue"
    if feature:
        return f"{service}: {feature} ({status})"
    return f"{service} ({status})"


def _graph_issue_reference_url(issue: dict[str, Any]) -> str:
    issue_id = _clean(issue.get("id"))
    if issue_id:
        safe_id = re.sub(r"[^A-Za-z0-9_-]+", "-", issue_id).strip("-")
        if safe_id:
            return f"{MICROSOFT_ADMIN_SERVICE_HEALTH_URL}#issue-{safe_id}"
    return MICROSOFT_ADMIN_SERVICE_HEALTH_URL


def _graph_issue_sort_timestamp(issue: dict[str, Any]) -> str | None:
    for field in ("lastModifiedDateTime", "startDateTime", "endDateTime"):
        value = issue.get(field)
        if isinstance(value, str) and value:
            return value
    return None


def _graph_issue_to_incident(issue: dict[str, Any]) -> dict[str, Any]:
    started_at = _clean(issue.get("startDateTime")) or None
    ended_at = _clean(issue.get("endDateTime")) or None
    classification = _clean(issue.get("classification"))
    status = _clean(issue.get("status"))
    service = _clean(issue.get("service"))
    ack_parts = [part for part in (service, classification, status) if part]
    return {
        "title": _graph_issue_title(issue),
        "started_at": started_at,
        "duration": _format_human_duration(started_at, ended_at),
        "acknowledgement": " / ".join(ack_parts) if ack_parts else "Microsoft Graph issue",
    }


def _graph_issue_to_update(issue: dict[str, Any]) -> dict[str, Any]:
    published_at = _graph_issue_sort_timestamp(issue)
    service = _clean(issue.get("service"))
    status = _clean(issue.get("status"))
    classification = _clean(issue.get("classification"))
    meta_parts = [part for part in (service, classification, status) if part]
    return {
        "title": _graph_issue_title(issue),
        "url": _graph_issue_reference_url(issue),
        "published_at": published_at,
        "source": "Microsoft Graph Service Communications",
        "meta": " / ".join(meta_parts) if meta_parts else "Tenant-auth API",
    }


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


def _graph_component_rows(
    health_overviews: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in health_overviews:
        if not isinstance(item, dict):
            continue
        service = _clean(item.get("service"))
        if not service:
            continue
        graph_status = _clean(item.get("status"))
        mapped_status = _graph_status_to_outage_status(graph_status)
        rows.append(
            {
                "name": service,
                "service": service,
                "status": mapped_status if mapped_status != "unknown" else (graph_status or "unknown"),
                "health": graph_status or mapped_status or "unknown",
                "updated_at": _clean(item.get("lastModifiedDateTime")) or None,
                "source": "Microsoft Graph",
            }
        )
    return rows


def _graph_top_impacted_services(
    issues: list[dict[str, Any]],
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        label = _clean(issue.get("service")) or _clean(issue.get("featureGroup")) or _clean(issue.get("feature"))
        if not label:
            continue
        counts[label] = counts.get(label, 0) + 1
    return [
        {"label": label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))[:limit]
    ]


def fetch_microsoft_graph_service_health() -> dict[str, Any]:
    credentials = _graph_credentials_from_env()
    if not credentials:
        raise RuntimeError("Microsoft Graph credentials are not configured")

    checked_at = _utc_now_iso()
    access_token = _graph_token(credentials)
    health_overviews = _graph_get_collection(
        "/admin/serviceAnnouncement/healthOverviews",
        access_token,
        top=100,
        max_pages=2,
    )
    issues = _graph_get_collection(
        "/admin/serviceAnnouncement/issues",
        access_token,
        top=80,
        max_pages=3,
    )

    valid_health = [item for item in health_overviews if isinstance(item, dict)]
    valid_issues = [item for item in issues if isinstance(item, dict)]
    sorted_issues = sorted(
        valid_issues,
        key=lambda item: _parse_iso8601(_graph_issue_sort_timestamp(item)) or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )
    active_issues = [item for item in sorted_issues if _graph_issue_is_active(item)]

    impacted_overviews = [
        item
        for item in valid_health
        if _graph_status_to_outage_status(item.get("status")) != "operational"
    ]

    worst_status = "operational" if valid_health else "unknown"
    for item in [*impacted_overviews, *active_issues]:
        candidate = _graph_status_to_outage_status(item.get("status"))
        if candidate == "major outage":
            worst_status = "major outage"
            break
        if candidate == "degraded" and worst_status != "major outage":
            worst_status = "degraded"
    if active_issues and worst_status == "operational":
        worst_status = "degraded"

    top_services = _graph_top_impacted_services(active_issues or sorted_issues[:12])
    service_names = [entry.get("label") for entry in top_services if isinstance(entry.get("label"), str)]
    services_preview = ", ".join(service_names[:3])
    if active_issues:
        summary = (
            f"Microsoft Graph reports {len(active_issues)} active Microsoft 365 service "
            f"{'issue' if len(active_issues) == 1 else 'issues'}"
        )
        if services_preview:
            summary += f" affecting {services_preview}"
        summary += "."
    elif impacted_overviews:
        impacted_services = [
            _clean(item.get("service"))
            for item in impacted_overviews
            if _clean(item.get("service"))
        ]
        preview = ", ".join(impacted_services[:3])
        summary = (
            f"Microsoft Graph health overviews show {len(impacted_overviews)} impacted "
            f"{'service' if len(impacted_overviews) == 1 else 'services'}"
        )
        if preview:
            summary += f" ({preview})"
        summary += "."
    elif valid_health:
        summary = (
            "Microsoft Graph health overviews indicate Microsoft 365 services are currently "
            f"operational across {len(valid_health)} tracked services."
        )
    elif sorted_issues:
        summary = "Microsoft Graph issues feed is reachable, but health overview status was unavailable."
        worst_status = "unknown"
    else:
        summary = "Microsoft Graph service communications returned no health overview or issue items."
        worst_status = "unknown"

    recent_issue_updates = [_graph_issue_to_update(item) for item in sorted_issues[:8]]
    if not recent_issue_updates:
        recent_issue_updates = [
            {
                "title": summary,
                "url": MICROSOFT_ADMIN_SERVICE_HEALTH_URL,
                "published_at": checked_at,
                "source": "Microsoft Graph Service Communications",
                "meta": "Tenant-auth API summary",
            }
        ]

    incidents = [_graph_issue_to_incident(item) for item in sorted_issues[:12]]
    active_incidents = [_graph_issue_to_incident(item) for item in active_issues[:8]]

    return {
        "source": "Microsoft Graph Service Communications",
        "url": MICROSOFT_ADMIN_SERVICE_HEALTH_URL,
        "summary": summary,
        "current_status": worst_status,
        "checked_at": checked_at,
        "updates": recent_issue_updates,
        "issues": sorted_issues[:20],
        "incidents": incidents,
        "active_incidents": active_incidents,
        "active_issue_count": len(active_issues),
        "issue_count": len(sorted_issues),
        "health_overview_count": len(valid_health),
        "impacted_overview_count": len(impacted_overviews),
        "top_impacted_services": top_services,
        "components": _graph_component_rows(valid_health)[:24],
    }


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
    graph_official: dict[str, Any] | None = None
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

    graph_credentials = _graph_credentials_from_env()
    if graph_credentials:
        started = time.perf_counter()
        try:
            graph_official = fetch_microsoft_graph_service_health()
            last_item_at = _latest_timestamp(graph_official.get("updates") or [], "published_at")
            if not last_item_at:
                last_item_at = graph_official.get("checked_at")
            freshness, age_minutes = _source_freshness(last_item_at)
            sources.append(
                {
                    "name": "Microsoft Graph Service Communications",
                    "kind": "official-api",
                    "url": f"{MICROSOFT_GRAPH_API_ROOT}/admin/serviceAnnouncement",
                    "ok": True,
                    "error": None,
                    "item_count": int(graph_official.get("issue_count") or 0),
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
                    "name": "Microsoft Graph Service Communications",
                    "kind": "official-api",
                    "url": f"{MICROSOFT_GRAPH_API_ROOT}/admin/serviceAnnouncement",
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

    if graph_official:
        graph_status_text = _normalize_outage_status_text(graph_official.get("current_status"))
        if graph_status_text != "unknown":
            outage["current_status"] = graph_status_text
            outage["current_status_origin"] = "Microsoft Graph"

        graph_components = graph_official.get("components")
        if isinstance(graph_components, list) and graph_components:
            outage["components"] = graph_components

        graph_top_services = graph_official.get("top_impacted_services")
        if (
            (not isinstance(outage.get("top_reported_issues"), list) or not outage.get("top_reported_issues"))
            and isinstance(graph_top_services, list)
            and graph_top_services
        ):
            outage["top_reported_issues"] = graph_top_services
            outage["top_reported_issues_meta"] = {
                "source": "Microsoft Graph",
                "kind": "service-issue-counts",
                "mode": "active" if int(graph_official.get("active_issue_count") or 0) > 0 else "recent",
            }

        graph_active_incidents = graph_official.get("active_incidents")
        if isinstance(graph_active_incidents, list) and graph_active_incidents:
            outage["incidents"] = _merge_incidents(
                graph_active_incidents,
                outage.get("incidents") or [],
                limit=8,
            )

        if int(graph_official.get("active_issue_count") or 0) > 0:
            outage["summary"] = graph_official.get("summary") or outage.get("summary")
            outage["summary_origin"] = "Microsoft Graph"
            outage["url"] = MICROSOFT_PUBLIC_STATUS_URL

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
    if graph_official:
        graph_report_items = [
            {
                "title": issue_update.get("title"),
                "url": issue_update.get("url"),
                "published_at": issue_update.get("published_at"),
                "source": "Microsoft Graph Service Communications",
                "meta": issue_update.get("meta"),
            }
            for issue_update in (graph_official.get("updates") or [])
            if isinstance(issue_update, dict)
        ]
        reports.extend(graph_report_items[:6])
    reports = _sort_by_datetime(_dedupe_by_url(reports), field="published_at")[:12]

    official_status_updates = (
        [item for item in (official_status.get("updates") or []) if isinstance(item, dict)]
        if official_status
        else []
    )
    if graph_official:
        official_status_updates.extend(
            [
                item
                for item in (graph_official.get("updates") or [])
                if isinstance(item, dict)
            ]
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
