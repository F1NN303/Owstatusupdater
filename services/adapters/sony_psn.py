from __future__ import annotations

import datetime as dt
from collections.abc import Callable, Mapping
from typing import Any


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _status_type_key(value: str | None, *, clean: Callable[[str | None], str]) -> str:
    text = clean(value).lower()
    if "outage" in text:
        return "outage"
    if "degrad" in text:
        return "degraded"
    if "maint" in text:
        return "maintenance"
    return "ok"


def _pick_message(status: dict[str, Any], *, clean: Callable[[str | None], str]) -> str:
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
        text = clean(messages.get(key))
        if text:
            return text
    for value in messages.values():
        text = clean(value if isinstance(value, str) else str(value))
        if text:
            return text
    return ""


def _event_timestamp(
    status: dict[str, Any],
    *,
    clean: Callable[[str | None], str],
    utc_now_iso: Callable[[], str],
) -> str:
    for field in ("startDate", "modifiedDate", "createdDate"):
        raw = clean(status.get(field))
        if raw:
            return raw
    return utc_now_iso()


def _event_title(
    scope: str,
    region_key: str,
    country: str | None,
    service_name: str | None,
    status: dict[str, Any],
    *,
    clean: Callable[[str | None], str],
    region_labels: Mapping[str, str],
) -> str:
    status_type = clean(status.get("statusType")) or "Status update"
    message = _pick_message(status, clean=clean)
    region_label = str(region_labels.get(region_key, region_key.upper()))
    if scope == "service" and service_name:
        base = f"{service_name}: {status_type}"
    elif scope == "country" and country:
        base = f"{country} region: {status_type}"
    else:
        base = f"{region_label}: {status_type}"
    if message:
        return f"{base} - {message}"
    return base


def parse_playstation_region_events(
    region_key: str,
    payload: dict[str, Any],
    *,
    clean: Callable[[str | None], str],
    region_labels: Mapping[str, str],
    utc_now_iso: Callable[[], str],
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    region_statuses = payload.get("status") if isinstance(payload.get("status"), list) else []
    countries = payload.get("countries") if isinstance(payload.get("countries"), list) else []

    for status in region_statuses:
        if not isinstance(status, dict):
            continue
        status_type = _status_type_key(status.get("statusType"), clean=clean)
        events.append(
            {
                "event_id": clean(status.get("statusId")) or f"{region_key}-region-{len(events)}",
                "scope": "region",
                "region": region_key,
                "country": None,
                "service": None,
                "status_type": status_type,
                "status_label": clean(status.get("statusType")) or "Status",
                "started_at": _event_timestamp(status, clean=clean, utc_now_iso=utc_now_iso),
                "title": _event_title(
                    "region",
                    region_key,
                    None,
                    None,
                    status,
                    clean=clean,
                    region_labels=region_labels,
                ),
            }
        )

    for country in countries:
        if not isinstance(country, dict):
            continue
        country_code = clean(country.get("countryCode"))
        country_statuses = country.get("status") if isinstance(country.get("status"), list) else []
        services = country.get("services") if isinstance(country.get("services"), list) else []

        for status in country_statuses:
            if not isinstance(status, dict):
                continue
            status_type = _status_type_key(status.get("statusType"), clean=clean)
            events.append(
                {
                    "event_id": clean(status.get("statusId")) or f"{region_key}-{country_code}-country-{len(events)}",
                    "scope": "country",
                    "region": region_key,
                    "country": country_code,
                    "service": None,
                    "status_type": status_type,
                    "status_label": clean(status.get("statusType")) or "Status",
                    "started_at": _event_timestamp(status, clean=clean, utc_now_iso=utc_now_iso),
                    "title": _event_title(
                        "country",
                        region_key,
                        country_code,
                        None,
                        status,
                        clean=clean,
                        region_labels=region_labels,
                    ),
                }
            )

        for service in services:
            if not isinstance(service, dict):
                continue
            service_name = clean(service.get("serviceName")) or clean(service.get("serviceId")) or "Service"
            service_statuses = service.get("status") if isinstance(service.get("status"), list) else []
            for status in service_statuses:
                if not isinstance(status, dict):
                    continue
                status_type = _status_type_key(status.get("statusType"), clean=clean)
                events.append(
                    {
                        "event_id": clean(status.get("statusId")) or f"{region_key}-{country_code}-{service_name}-{len(events)}",
                        "scope": "service",
                        "region": region_key,
                        "country": country_code,
                        "service": service_name,
                        "status_type": status_type,
                        "status_label": clean(status.get("statusType")) or "Status",
                        "started_at": _event_timestamp(status, clean=clean, utc_now_iso=utc_now_iso),
                        "title": _event_title(
                            "service",
                            region_key,
                            country_code,
                            service_name,
                            status,
                            clean=clean,
                            region_labels=region_labels,
                        ),
                    }
                )

    deduped: dict[tuple[str, str, str | None, str | None], dict[str, Any]] = {}
    for event in events:
        key = (str(event["event_id"]), str(event["scope"]), event.get("country"), event.get("service"))
        deduped[key] = event
    out = list(deduped.values())
    out.sort(key=lambda item: _parse_iso8601(item.get("started_at")) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)
    return out


__all__ = ["parse_playstation_region_events"]
