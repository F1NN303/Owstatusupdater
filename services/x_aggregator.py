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
    _sort_by_datetime,
    _source_freshness,
)
from services.core.source_runner import (
    CallableSourceAdapter,
    SourceAdapterSpec,
    SourceRunResult,
    run_source_adapter,
)

UA = {"User-Agent": "X-Service-Radar/1.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

X_STATUS_PAGE_URL = "https://docs.x.com/status"
X_INCIDENTS_URL = "https://docs.x.com/incidents"
X_DEVELOPER_DOCS_URL = "https://docs.x.com/"

STATUSGATOR_URL = "https://statusgator.com/services/x"
ISDOWN_STATUS_URL = "https://isdown.app/status/x"

_MONTH_HEADING_PATTERN = re.compile(r"^\W*([A-Za-z]+)\s+(\d{4})$")
_PARTIAL_TIMESTAMP_PATTERN = re.compile(
    r"^(?:(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2}),\s*)?"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?)"
    r"(?:\s*(?P<tz>UTC))?$",
    flags=re.IGNORECASE,
)

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _run_x_source(
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
                service_id="x",
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
    end = _parse_iso8601(ended_at) if ended_at else _utc_now()
    if not start or not end or end < start:
        return None
    seconds = max(int((end - start).total_seconds()), 0)
    if seconds <= 0:
        return "ongoing" if ended_at is None else "0m"
    days, rem = divmod(seconds, 24 * 3600)
    hours, rem = divmod(rem, 3600)
    minutes = rem // 60
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


def _status_rank(value: str | None) -> int:
    normalized = _normalize_outage_status_text(value)
    if normalized == "major outage":
        return 3
    if normalized == "degraded":
        return 2
    if normalized == "operational":
        return 1
    return 0


def _strongest_status(values: list[str]) -> str:
    strongest = "unknown"
    strongest_rank = 0
    for value in values:
        rank = _status_rank(value)
        if rank > strongest_rank:
            strongest = _normalize_outage_status_text(value)
            strongest_rank = rank
    return strongest


def _slugify_component_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", _clean(name).lower()).strip("-")
    return slug or "component"


def _x_component_status_to_outage_status(value: str | None) -> str:
    text = _clean(value).lower()
    if not text:
        return "unknown"
    if text in {"normal", "operational"}:
        return "operational"
    if any(token in text for token in ("outage", "down", "unavailable")):
        return "major outage"
    if any(token in text for token in ("degraded", "latency", "maintenance", "issue", "incident")):
        return "degraded"
    return _normalize_outage_status_text(text)


def _parse_component_snapshot(html: str, *, checked_at: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")

    description = ""
    for candidate in soup.find_all(["p", "span", "div"]):
        text = _clean(candidate.get_text(" ", strip=True))
        lowered = text.lower()
        if not text or len(text) > 120:
            continue
        if lowered.startswith("all systems are") or lowered.startswith("some systems are"):
            description = text
            break

    components: list[dict[str, Any]] = []
    degraded_components: list[dict[str, Any]] = []
    seen_names: set[str] = set()

    for heading in soup.find_all("h2"):
        name = _clean(heading.get_text(" ", strip=True)).lstrip("\u200b").strip()
        if not name or name.lower() == "incident history":
            continue

        sibling = heading.find_next_sibling("div")
        status_label = _clean(sibling.get_text(" ", strip=True) if sibling else "")
        if not status_label or len(status_label) > 48:
            continue

        normalized_name = name.casefold()
        if normalized_name in seen_names:
            continue
        seen_names.add(normalized_name)

        outage_status = _x_component_status_to_outage_status(status_label)
        status_value = (
            "offline"
            if outage_status == "major outage"
            else "degraded" if outage_status == "degraded" else "online" if outage_status == "operational" else "unknown"
        )
        row = {
            "component_id": _slugify_component_id(name),
            "name": name,
            "status": status_value,
            "state": status_label,
            "source": "X Developer Platform Status",
            "updated_at": checked_at,
            "url": X_STATUS_PAGE_URL,
        }
        components.append(row)
        if status_value != "online":
            degraded_components.append({"label": name, "count": 1})

    current_status = _strongest_status([row.get("status", "unknown") for row in components])
    if current_status == "unknown":
        current_status = _normalize_outage_status_text(description)

    if description:
        summary = description
    elif degraded_components:
        names = ", ".join(item["label"] for item in degraded_components[:3])
        summary = f"X Developer Platform reports issues affecting: {names}."
    elif components:
        summary = "X Developer Platform reports all tracked systems normal."
    else:
        summary = "Official X developer platform status is currently unavailable."

    return {
        "summary": summary,
        "description": description or summary,
        "current_status": current_status,
        "components": components,
        "top_component_issues": degraded_components[:8],
        "checked_at": checked_at,
    }


def _parse_month_heading(heading: str) -> tuple[int, int] | None:
    match = _MONTH_HEADING_PATTERN.match(_clean(heading).lstrip("\u200b").strip())
    if not match:
        return None
    month_name = match.group(1)
    year = int(match.group(2))
    try:
        month = dt.datetime.strptime(month_name, "%B").month
    except ValueError:
        try:
            month = dt.datetime.strptime(month_name, "%b").month
        except ValueError:
            return None
    return year, month


def _parse_partial_timestamp(
    value: str,
    *,
    year: int,
    default_month: int | None = None,
    default_day: int | None = None,
) -> dt.datetime | None:
    text = _clean(value)
    if not text or text.lower() == "current":
        return None
    match = _PARTIAL_TIMESTAMP_PATTERN.match(text)
    if not match:
        return None

    month_token = match.group("month")
    day_token = match.group("day")
    time_token = match.group("time")

    month = default_month
    if month_token:
        try:
            month = dt.datetime.strptime(month_token, "%B").month
        except ValueError:
            try:
                month = dt.datetime.strptime(month_token, "%b").month
            except ValueError:
                return None
    if month is None:
        return None

    day = int(day_token) if day_token else default_day
    if day is None:
        return None

    parts = [int(part) for part in time_token.split(":")]
    if len(parts) == 2:
        hour, minute = parts
        second = 0
    else:
        hour, minute, second = parts
    try:
        return dt.datetime(year, month, day, hour, minute, second, tzinfo=dt.UTC)
    except ValueError:
        return None


def _parse_range_timestamps(range_text: str, *, year: int, month: int) -> tuple[str | None, str | None]:
    raw_parts = [part.strip() for part in re.split(r"\s*-\s*", _clean(range_text), maxsplit=1) if part.strip()]
    if not raw_parts:
        return None, None

    start_dt = _parse_partial_timestamp(raw_parts[0], year=year, default_month=month)
    if start_dt is None:
        return None, None

    end_dt = None
    if len(raw_parts) > 1 and raw_parts[1].lower() != "current":
        end_dt = _parse_partial_timestamp(
            raw_parts[1],
            year=year,
            default_month=start_dt.month,
            default_day=start_dt.day,
        )

    started_at = start_dt.isoformat().replace("+00:00", "Z")
    ended_at = end_dt.isoformat().replace("+00:00", "Z") if end_dt and end_dt >= start_dt else None
    return started_at, ended_at


def _dedupe_history_rows(
    items: list[dict[str, Any]],
    *,
    timestamp_field: str,
    limit: int,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()
    for item in _sort_by_datetime(items, field=timestamp_field):
        title = _clean(item.get("title"))
        timestamp = _clean(item.get(timestamp_field)) or None
        key = (title, timestamp)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out[:limit]


def _parse_incident_history(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    incidents: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    active_incidents: list[dict[str, Any]] = []

    for heading in soup.find_all("h2"):
        heading_text = _clean(heading.get_text(" ", strip=True)).lstrip("\u200b").strip()
        month_context = _parse_month_heading(heading_text)
        if not month_context:
            continue
        year, month = month_context

        container = heading.find_next_sibling("div")
        if container is None:
            continue

        for step in container.find_all("div", class_=lambda classes: classes and "step-container" in classes):
            title_tag = step.find("p")
            title = _clean(title_tag.get_text(" ", strip=True) if title_tag else "")
            if not title or title.lower() == "no incidents":
                continue

            detail_text = ""
            for candidate in step.find_all("div"):
                candidate_text = _clean(candidate.get_text(" ", strip=True))
                if "|" in candidate_text and ("incident" in candidate_text.lower() or "current" in candidate_text.lower()):
                    detail_text = candidate_text
                    break

            status_text = detail_text
            range_text = ""
            if "|" in detail_text:
                status_text, range_text = [part.strip() for part in detail_text.split("|", 1)]

            started_at, ended_at = _parse_range_timestamps(range_text, year=year, month=month)
            duration = _format_human_duration(started_at, ended_at)
            if duration is None:
                if range_text and "current" in range_text.lower() and started_at:
                    duration = _format_human_duration(started_at, None)
                elif range_text:
                    duration = range_text
                else:
                    duration = status_text or "incident history entry"

            row = {
                "title": title,
                "started_at": started_at,
                "duration": duration,
                "acknowledgement": status_text or "X Developer Platform",
                "source": "X Developer Platform",
                "url": X_INCIDENTS_URL,
            }
            incidents.append(row)

            published_at = started_at or _utc_now_iso()
            updates.append(
                {
                    "title": title,
                    "url": X_INCIDENTS_URL,
                    "published_at": published_at,
                    "source": "X Developer Platform",
                    "channel": "official-status-page",
                    "meta": status_text if not range_text else f"{status_text} / {range_text}",
                }
            )

            lowered_detail = f"{status_text} {range_text}".lower()
            if "ongoing" in lowered_detail or "current" in lowered_detail:
                active_incidents.append(dict(row))

    incidents = _dedupe_history_rows(incidents, timestamp_field="started_at", limit=12)
    updates = _dedupe_history_rows(updates, timestamp_field="published_at", limit=12)
    active_incidents = _dedupe_history_rows(active_incidents, timestamp_field="started_at", limit=8)
    return {
        "incidents": incidents,
        "updates": updates,
        "active_incidents": active_incidents,
    }


def _build_x_official_summary(
    description: str,
    current_status: str,
    components: list[dict[str, Any]],
    active_incidents: list[dict[str, Any]],
    recent_incidents: list[dict[str, Any]],
) -> str:
    if active_incidents:
        latest = active_incidents[0]
        latest_title = _clean(latest.get("title")) or "X incident"
        if len(active_incidents) == 1:
            return f"X Developer Platform reports an active incident: {latest_title}."
        return f"X Developer Platform reports {len(active_incidents)} active incidents. Latest: {latest_title}."

    degraded_components = [
        _clean(component.get("name"))
        for component in components
        if isinstance(component, dict) and _clean(component.get("status")) not in {"online", "operational"}
    ]
    if degraded_components:
        names = ", ".join(degraded_components[:3])
        return f"X Developer Platform reports issues affecting: {names}."

    normalized_status = _normalize_outage_status_text(current_status)
    if normalized_status == "operational" and description:
        return f"X Developer Platform reports {description}"

    latest_started_at = _clean(recent_incidents[0].get("started_at")) if recent_incidents else None
    latest_age_h = _hours_since(latest_started_at)
    if description and isinstance(latest_age_h, float):
        rounded = max(1, int(round(latest_age_h)))
        if latest_age_h <= 24:
            return f"X Developer Platform reports {description} Latest listed incident started about {rounded}h ago."
        return f"X Developer Platform reports {description} Latest listed incident was about {rounded}h ago."
    if description:
        return f"X Developer Platform reports {description}"
    if recent_incidents:
        return f"X Developer Platform incident history is available. Latest listed incident: {recent_incidents[0].get('title')}."
    return "Official X developer platform status is currently unavailable."


def fetch_x_official_bundle() -> dict[str, Any]:
    checked_at = _utc_now_iso()
    status_html = _request_text(X_STATUS_PAGE_URL)
    incidents_html = _request_text(X_INCIDENTS_URL)

    status_snapshot = _parse_component_snapshot(status_html, checked_at=checked_at)
    incident_snapshot = _parse_incident_history(incidents_html)

    components = status_snapshot.get("components") or []
    current_status = _normalize_outage_status_text(status_snapshot.get("current_status"))
    active_incidents = incident_snapshot.get("active_incidents") or []
    recent_incidents = incident_snapshot.get("incidents") or []
    description = _clean(status_snapshot.get("description")) or _clean(status_snapshot.get("summary"))

    return {
        "summary": _build_x_official_summary(
            description,
            current_status,
            list(components) if isinstance(components, list) else [],
            list(active_incidents) if isinstance(active_incidents, list) else [],
            list(recent_incidents) if isinstance(recent_incidents, list) else [],
        ),
        "description": description,
        "current_status": current_status,
        "components": components,
        "top_component_issues": status_snapshot.get("top_component_issues") or [],
        "incidents": recent_incidents,
        "active_incidents": active_incidents,
        "active_incident_count": len(active_incidents) if isinstance(active_incidents, list) else 0,
        "updates": incident_snapshot.get("updates") or [],
        "checked_at": checked_at,
    }


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
            f"StatusGator indicates X is currently {normalized_status} "
            f"with {reports_24h} user-submitted reports in the past 24 hours."
        )
    if normalized_status != "unknown":
        if isinstance(latest_incident_age_hours, float):
            rounded_age_hours = max(1, int(round(latest_incident_age_hours)))
            if latest_incident_age_hours <= 24:
                return (
                    f"StatusGator indicates X is currently {normalized_status}. "
                    f"Most recent listed incident started about {rounded_age_hours}h ago."
                )
            return (
                f"StatusGator indicates X is currently {normalized_status}. "
                f"Latest listed incident was about {rounded_age_hours}h ago."
            )
        return f"StatusGator indicates X is currently {normalized_status}."
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
        summary_regex=r"StatusGator reports that X is currently .*?past 24 hours\.",
        synthesize_summary=_synthesize_statusgator_summary,
    )


def _extract_isdown_status_text(page_text: str) -> tuple[str, str]:
    match = re.search(
        r"What is X status right now\?\s+X is ([^.]+)\.\s+IsDown is reporting that X is ([^.]+)\.",
        page_text,
        flags=re.IGNORECASE,
    )
    if match:
        primary_status = _clean(match.group(1))
        supporting_status = _clean(match.group(2))
        status_phrase = primary_status or supporting_status or "having issues"
        return f"IsDown indicates X is {status_phrase}.", _normalize_outage_status_text(status_phrase)

    fallback_match = re.search(r"What is X status right now\?\s+X is ([^.]+)\.", page_text, flags=re.IGNORECASE)
    if fallback_match:
        status_phrase = _clean(fallback_match.group(1))
        return f"IsDown indicates X is {status_phrase}.", _normalize_outage_status_text(status_phrase)

    return "IsDown status summary unavailable.", "unknown"


def fetch_isdown_outages() -> dict[str, Any]:
    html = _request_text(ISDOWN_STATUS_URL)
    return parse_isdown_outage_html(
        html,
        source_url=ISDOWN_STATUS_URL,
        extract_status_text=_extract_isdown_status_text,
    )


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


def _statusgator_item_count(payload: Any) -> int | None:
    return len(payload.get("incidents") or []) if isinstance(payload, dict) else 0


def _statusgator_last_item_at(payload: Any) -> str | None:
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
    seen_urls: set[tuple[str, str | None]] = set()
    for item in _sort_by_datetime(official_updates, field="published_at"):
        url = str(item.get("url") or "")
        published_at = str(item.get("published_at") or "") or None
        key = (url, published_at)
        if url and key in seen_urls:
            continue
        if url:
            seen_urls.add(key)
        updates.append(
            {
                "title": _clean(item.get("title")) or "X platform incident",
                "url": url or X_INCIDENTS_URL,
                "published_at": published_at,
                "source": _clean(item.get("source")) or "X Developer Platform",
                "channel": "official-status-page",
                "meta": item.get("meta"),
            }
        )
    updates = updates[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official X status updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _effective_active_incident_count(official_status: dict[str, Any] | None) -> int:
    if not isinstance(official_status, dict):
        return 0
    active_incidents = official_status.get("active_incidents")
    if isinstance(active_incidents, list):
        return len([incident for incident in active_incidents if isinstance(incident, dict)])
    return int(official_status.get("active_incident_count") or 0)


def _collect_payload(scoring_profile: str | None = None) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    official_status: dict[str, Any] | None = None
    official_source_entry: dict[str, Any] | None = None
    isdown_outage: dict[str, Any] | None = None

    statusgator_run = _run_x_source(
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

    isdown_run = _run_x_source(
        adapter_id="isdown_x",
        name="IsDown (X)",
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

    official_run = _run_x_source(
        adapter_id="x_developer_status",
        name="X Developer Platform Status",
        kind="official-html",
        url=X_STATUS_PAGE_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_x_official_bundle,
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
            outage["current_status_origin"] = "X Developer Platform Status"
        if official_status.get("summary"):
            outage["summary"] = official_status.get("summary")
            outage["summary_origin"] = "X Developer Platform Status"
        outage["url"] = X_STATUS_PAGE_URL

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
                "source": "X Developer Platform Status",
                "kind": "degraded-components",
                "mode": "active" if effective_active_incident_count > 0 else "snapshot",
            }
            if provider_top_issues:
                outage["top_reported_issues_provider"] = provider_top_issues
        elif official_status_text == "operational" and official_source_freshness in {"fresh", "warm"}:
            outage["top_reported_issues"] = []
            outage["top_reported_issues_meta"] = {
                "source": "X Developer Platform Status",
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
            "url": incident.get("url") or outage.get("url") or STATUSGATOR_URL,
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
    analytics["model_version"] = "x-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "X Developer Platform Status",
            "url": X_STATUS_PAGE_URL,
            "source": "Official",
            "meta": "Status page",
            "published_at": generated_at,
        },
        {
            "title": "X Incident History",
            "url": X_INCIDENTS_URL,
            "source": "Official",
            "meta": "Incident history",
            "published_at": generated_at,
        },
        {
            "title": "X Developer Platform Docs",
            "url": X_DEVELOPER_DOCS_URL,
            "source": "Official",
            "meta": "Developer docs",
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


__all__ = ["build_dashboard_payload", "fetch_x_official_bundle"]
