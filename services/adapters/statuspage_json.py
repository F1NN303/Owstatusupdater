from __future__ import annotations

import datetime as dt
from typing import Any, Callable

from services.core.shared import (
    _clean,
    _dedupe_by_url,
    _normalize_outage_status_text,
    _sort_by_datetime,
)


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


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


def statuspage_indicator_to_outage_status(indicator: Any) -> str:
    token = _clean(str(indicator or "")).lower()
    if token in {"none", "operational"}:
        return "operational"
    if token in {"critical", "major", "major_outage"}:
        return "major outage"
    if token in {"minor", "maintenance", "under_maintenance"}:
        return "degraded"
    return _normalize_outage_status_text(token)


def statuspage_component_status_to_outage_status(status: Any) -> str:
    token = _clean(str(status or "")).lower()
    if token in {"operational", "none"}:
        return "operational"
    if token in {"major_outage", "partial_outage"}:
        return "major outage" if token == "major_outage" else "degraded"
    if token in {"degraded_performance", "under_maintenance"}:
        return "degraded"
    return _normalize_outage_status_text(token)


def statuspage_incident_is_active(incident: dict[str, Any]) -> bool:
    if incident.get("resolved_at"):
        return False
    status_token = _clean(str(incident.get("status") or "")).lower()
    if status_token in {"resolved", "postmortem", "completed"}:
        return False
    return True


def statuspage_incident_url(page_url: str, incident_id: str, update_id: str | None = None) -> str:
    base = f"{page_url.rstrip('/')}/incidents/{incident_id}"
    if update_id:
        return f"{base}#{update_id}"
    return base


def _incident_started_at(incident: dict[str, Any]) -> str | None:
    return (
        _clean(incident.get("scheduled_for"))
        or _clean(incident.get("created_at"))
        or _clean(incident.get("updated_at"))
        or None
    )


def _incident_ended_at(incident: dict[str, Any]) -> str | None:
    return (
        _clean(incident.get("scheduled_until"))
        or _clean(incident.get("resolved_at"))
        or None
    )


def _incident_latest_body(incident: dict[str, Any]) -> str | None:
    updates = incident.get("incident_updates")
    if not isinstance(updates, list):
        return None
    valid_updates = [item for item in updates if isinstance(item, dict)]
    valid_updates = sorted(
        valid_updates,
        key=lambda item: _parse_iso8601(
            _clean(item.get("display_at")) or _clean(item.get("updated_at")) or _clean(item.get("created_at"))
        )
        or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )
    for update in valid_updates:
        body = _clean(update.get("body"))
        if body:
            return body[:320]
    return None


def statuspage_incident_is_scheduled_maintenance(incident: dict[str, Any]) -> bool:
    impact_token = _clean(str(incident.get("impact") or "")).lower()
    status_token = _clean(str(incident.get("status") or "")).lower()
    scheduled_for = _clean(incident.get("scheduled_for"))
    scheduled_until = _clean(incident.get("scheduled_until"))
    title = _clean(incident.get("name")).lower()
    latest_body = (_incident_latest_body(incident) or "").lower()

    if impact_token == "maintenance":
        return True
    if scheduled_for or scheduled_until:
        return True
    if status_token in {"scheduled", "in_progress", "verifying"} and "maintenance" in f"{title} {latest_body}":
        return True
    return "maintenance" in title or "scheduled maintenance" in latest_body


def statuspage_incident_is_relevant_maintenance(incident: dict[str, Any]) -> bool:
    if not statuspage_incident_is_scheduled_maintenance(incident):
        return False
    status_token = _clean(str(incident.get("status") or "")).lower()
    if status_token in {"resolved", "postmortem", "completed"}:
        return False
    ended_at = _parse_iso8601(_incident_ended_at(incident))
    if ended_at and ended_at < _utc_now():
        return False
    return True


def _incident_to_scheduled_maintenance(
    incident: dict[str, Any],
    *,
    page_url: str,
    source_name: str,
) -> dict[str, Any]:
    title = _clean(incident.get("name")) or "Scheduled maintenance"
    incident_id = _clean(incident.get("id"))
    return {
        "title": title,
        "starts_at": _incident_started_at(incident),
        "ends_at": _incident_ended_at(incident),
        "status": _humanize_status_token(incident.get("status")) or "Scheduled",
        "summary": _incident_latest_body(incident),
        "source": source_name,
        "url": statuspage_incident_url(page_url, incident_id) if incident_id else page_url,
    }


def _incident_to_outage_incident(
    incident: dict[str, Any],
    *,
    page_url: str,
    source_name: str,
) -> dict[str, Any]:
    title = _clean(incident.get("name")) or "Statuspage incident"
    started_at = _incident_started_at(incident)
    resolved_at = _clean(incident.get("resolved_at")) or None
    impact = _humanize_status_token(incident.get("impact"))
    status_label = _humanize_status_token(incident.get("status"))
    ack_parts = [part for part in (impact, status_label) if part]
    incident_id = _clean(incident.get("id"))
    return {
        "title": title,
        "started_at": started_at,
        "duration": _format_human_duration(started_at, resolved_at),
        "acknowledgement": " / ".join(ack_parts) if ack_parts else source_name,
        "source": source_name,
        "url": statuspage_incident_url(page_url, incident_id) if incident_id else page_url,
    }


def _incident_update_rows(
    incident: dict[str, Any],
    *,
    page_url: str,
    source_name: str,
) -> list[dict[str, Any]]:
    incident_id = _clean(incident.get("id"))
    incident_name = _clean(incident.get("name")) or "Statuspage incident"
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
                "url": statuspage_incident_url(page_url, incident_id, update_id) if incident_id else page_url,
                "published_at": published_at,
                "source": source_name,
                "channel": "official-status-page",
                "meta": " / ".join(meta_parts) if meta_parts else "Statuspage incident update",
            }
        )
    return rows


def statuspage_component_rows(
    components: list[dict[str, Any]],
    *,
    source_name: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        name = _clean(component.get("name"))
        raw_status = _clean(component.get("status"))
        if not name:
            continue
        mapped = statuspage_component_status_to_outage_status(raw_status)
        rows.append(
            {
                "name": name,
                "status": mapped if mapped != "unknown" else (raw_status or "unknown"),
                "health": raw_status or mapped or "unknown",
                "updated_at": _clean(component.get("updated_at")) or None,
                "source": source_name,
            }
        )
    return rows


def statuspage_top_issue_labels(
    components: list[dict[str, Any]],
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        label = _clean(component.get("name"))
        status_value = statuspage_component_status_to_outage_status(component.get("status"))
        if not label or status_value in {"unknown", "operational"}:
            continue
        rows.append({"label": label, "count": 1})
        if len(rows) >= limit:
            break
    return rows


def parse_statuspage_official_payloads(
    *,
    status_payload: Any,
    components_payload: Any,
    incidents_payload: Any,
    page_url: str,
    source_name: str,
    summary_builder: Callable[[str, str, list[dict[str, Any]], list[dict[str, Any]]], str] | None = None,
    checked_at: str | None = None,
) -> dict[str, Any]:
    status_block = status_payload.get("status") if isinstance(status_payload, dict) else {}
    status_block = status_block if isinstance(status_block, dict) else {}
    indicator = _clean(status_block.get("indicator")) or "unknown"
    description = _clean(status_block.get("description")) or "Status description unavailable"
    current_status = statuspage_indicator_to_outage_status(indicator)

    raw_components = components_payload.get("components") if isinstance(components_payload, dict) else []
    raw_components = [row for row in (raw_components or []) if isinstance(row, dict)]
    component_rows = statuspage_component_rows(raw_components, source_name=source_name)

    raw_incidents = incidents_payload.get("incidents") if isinstance(incidents_payload, dict) else []
    valid_incidents = [row for row in (raw_incidents or []) if isinstance(row, dict)]
    valid_incidents = sorted(
        valid_incidents,
        key=lambda item: _parse_iso8601(_clean(item.get("updated_at")) or _clean(item.get("created_at")))
        or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )

    official_incidents = [
        _incident_to_outage_incident(item, page_url=page_url, source_name=source_name)
        for item in valid_incidents
    ][:12]
    scheduled_maintenances = [
        _incident_to_scheduled_maintenance(item, page_url=page_url, source_name=source_name)
        for item in valid_incidents
        if statuspage_incident_is_relevant_maintenance(item)
    ]
    scheduled_maintenances = sorted(
        [item for item in scheduled_maintenances if item.get("starts_at")],
        key=lambda item: _parse_iso8601(item.get("starts_at")) or dt.datetime.max.replace(tzinfo=dt.UTC),
    )[:8]
    active_incidents = [
        _incident_to_outage_incident(item, page_url=page_url, source_name=source_name)
        for item in valid_incidents
        if statuspage_incident_is_active(item)
    ][:8]

    official_updates: list[dict[str, Any]] = []
    if checked_at:
        official_updates.append(
            {
                "title": f"{source_name}: {description}",
                "url": page_url,
                "published_at": checked_at,
                "source": source_name,
                "channel": "official-status-page",
                "meta": f"Indicator: {indicator}",
            }
        )
    for incident in valid_incidents[:12]:
        official_updates.extend(
            _incident_update_rows(
                incident,
                page_url=page_url,
                source_name=source_name,
            )
        )
    official_updates = _sort_by_datetime(_dedupe_by_url(official_updates), field="published_at")[:24]

    top_issues = statuspage_top_issue_labels(component_rows)
    if summary_builder:
        summary = summary_builder(description, current_status, active_incidents, official_incidents)
    else:
        if active_incidents:
            summary = f"{source_name} reports {len(active_incidents)} active incidents."
        else:
            summary = f"{source_name} reports {description}."

    return {
        "source": source_name,
        "url": page_url,
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
        "scheduled_maintenances": scheduled_maintenances,
        "active_incident_count": len(active_incidents),
        "incident_count": len(official_incidents),
    }


__all__ = [
    "parse_statuspage_official_payloads",
    "statuspage_component_rows",
    "statuspage_component_status_to_outage_status",
    "statuspage_indicator_to_outage_status",
    "statuspage_incident_is_active",
    "statuspage_incident_url",
    "statuspage_top_issue_labels",
]
