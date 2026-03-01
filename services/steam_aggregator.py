from __future__ import annotations

import datetime as dt
import statistics
import threading
import time
import re
from typing import Any, Callable

import requests

from services.adapters.isdown import parse_isdown_outage_html
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

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

STEAM_SERVER_INFO_URL = "https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/"
STEAM_CM_LIST_CONNECT_URL = (
    "https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&maxcount=50"
)
STEAM_CM_LIST_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?cellid=0&maxcount=50"
STEAM_STORE_URL = "https://store.steampowered.com/"
STEAM_COMMUNITY_URL = "https://steamcommunity.com/"
ISDOWN_STATUS_URL = "https://isdown.app/status/steam"

STEAM_WEB_API_DOCS_URL = "https://steamcommunity.com/dev"
STEAM_HELP_MAINTENANCE_URL = "https://help.steampowered.com/en/faqs/view/5814-D9A3-BE42-62DF"
STEAMSTAT_COMMUNITY_URL = "https://steamstat.us/"

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


def _run_steam_source(
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
                service_id="steam",
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


def _request_json(url: str, timeout: int = REQUEST_TIMEOUT) -> Any:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.json()


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _probe_endpoint(url: str, name: str) -> dict[str, Any]:
    started = time.perf_counter()
    response = requests.get(url, timeout=REQUEST_TIMEOUT, headers=UA, allow_redirects=True, stream=True)
    try:
        if response.status_code >= 400:
            raise RuntimeError(f"{name} returned HTTP {response.status_code}")
        content_length_raw = response.headers.get("content-length")
        content_length = 0
        if content_length_raw:
            try:
                content_length = max(int(content_length_raw), 0)
            except (TypeError, ValueError):
                content_length = 0
        latency_ms = int((time.perf_counter() - started) * 1000)
        checked_at = _utc_now_iso()
        return {
            "checked_at": checked_at,
            "name": name,
            "url": url,
            "final_url": str(response.url),
            "status_code": response.status_code,
            "latency_ms": max(latency_ms, 0),
            "content_length": content_length,
        }
    finally:
        response.close()


def fetch_steam_server_info() -> dict[str, Any]:
    payload = _request_json(STEAM_SERVER_INFO_URL)
    checked_at = _utc_now_iso()
    servertime = payload.get("servertime") if isinstance(payload, dict) else None
    servertimestring = _clean(payload.get("servertimestring")) if isinstance(payload, dict) else ""
    if servertime in (None, "") and not servertimestring:
        raise RuntimeError("Steam GetServerInfo payload is missing expected fields")
    return {
        "checked_at": checked_at,
        "servertime": servertime,
        "servertimestring": servertimestring or None,
    }


def fetch_steam_cm_list_connect() -> dict[str, Any]:
    payload = _request_json(STEAM_CM_LIST_CONNECT_URL)
    response = payload.get("response") if isinstance(payload, dict) else None
    if not isinstance(response, dict):
        raise RuntimeError("Steam GetCMListForConnect payload is missing response block")
    rows = response.get("serverlist")
    if not isinstance(rows, list):
        raise RuntimeError("Steam GetCMListForConnect payload is missing serverlist")

    loads: list[float] = []
    by_dc: dict[str, int] = {}
    high_load_count = 0
    critical_load_count = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        dc = _clean(row.get("dc") or "unknown").lower() or "unknown"
        by_dc[dc] = by_dc.get(dc, 0) + 1
        load_value = _to_float(row.get("wtd_load"))
        if load_value is None:
            load_value = _to_float(row.get("load"))
        if load_value is None:
            continue
        loads.append(load_value)
        if load_value >= 85:
            high_load_count += 1
        if load_value >= 95:
            critical_load_count += 1

    top_dcs = [
        {"dc": dc, "count": count}
        for dc, count in sorted(by_dc.items(), key=lambda item: (-item[1], item[0]))[:5]
    ]
    avg_load = round(statistics.fmean(loads), 2) if loads else None
    max_load = round(max(loads), 2) if loads else None
    checked_at = _utc_now_iso()
    return {
        "checked_at": checked_at,
        "sample_count": len(rows),
        "load_sample_count": len(loads),
        "avg_load": avg_load,
        "max_load": max_load,
        "high_load_count": high_load_count,
        "critical_load_count": critical_load_count,
        "top_datacenters": top_dcs,
    }


def fetch_steam_cm_list() -> dict[str, Any]:
    payload = _request_json(STEAM_CM_LIST_URL)
    response = payload.get("response") if isinstance(payload, dict) else None
    if not isinstance(response, dict):
        raise RuntimeError("Steam GetCMList payload is missing response block")
    tcp_list = response.get("serverlist")
    ws_list = response.get("serverlist_websockets")
    if not isinstance(tcp_list, list) and not isinstance(ws_list, list):
        raise RuntimeError("Steam GetCMList payload is missing endpoint lists")

    tcp_count = len(tcp_list) if isinstance(tcp_list, list) else 0
    ws_count = len(ws_list) if isinstance(ws_list, list) else 0
    checked_at = _utc_now_iso()
    return {
        "checked_at": checked_at,
        "tcp_count": tcp_count,
        "websocket_count": ws_count,
        "total_endpoints": tcp_count + ws_count,
    }


def fetch_steam_store_probe() -> dict[str, Any]:
    return _probe_endpoint(STEAM_STORE_URL, "Steam Store")


def fetch_steam_community_probe() -> dict[str, Any]:
    return _probe_endpoint(STEAM_COMMUNITY_URL, "Steam Community")


def _extract_isdown_status_text(page_text: str) -> tuple[str, str]:
    summary_match = re.search(
        r"What is .*? status right now\?\s+.*? is (.+?)\s+IsDown last checked",
        page_text,
        flags=re.IGNORECASE,
    )
    if not summary_match:
        return "Status summary unavailable.", "unknown"

    status_phrase = _clean(summary_match.group(1))
    summary = f"IsDown indicates Steam is {status_phrase}."
    lowered = status_phrase.lower()
    if any(token in lowered for token in ("operational", "working normally", "online")):
        current_status = "operational"
    elif any(token in lowered for token in ("major outage", "outage", "down", "offline")):
        current_status = "major outage"
    elif any(token in lowered for token in ("partial outage", "degraded", "issue", "maintenance")):
        current_status = "degraded"
    else:
        current_status = lowered or "unknown"
    return summary, current_status


def fetch_isdown_outages() -> dict[str, Any]:
    response = requests.get(ISDOWN_STATUS_URL, timeout=REQUEST_TIMEOUT, headers=UA)
    response.raise_for_status()
    return parse_isdown_outage_html(
        response.text,
        source_url=ISDOWN_STATUS_URL,
        extract_status_text=_extract_isdown_status_text,
    )


def _single_item_count(payload: Any) -> int | None:
    return 1 if isinstance(payload, dict) else 0


def _single_last_item_at(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    return str(payload.get("checked_at") or "") or None


def _cm_connect_item_count(payload: Any) -> int | None:
    if not isinstance(payload, dict):
        return 0
    try:
        return int(payload.get("sample_count") or 0)
    except (TypeError, ValueError):
        return 0


def _cm_list_item_count(payload: Any) -> int | None:
    if not isinstance(payload, dict):
        return 0
    try:
        return int(payload.get("total_endpoints") or 0)
    except (TypeError, ValueError):
        return 0


def _isdown_item_count(payload: Any) -> int | None:
    return len(payload.get("user_reports_24h") or []) if isinstance(payload, dict) else 0


def _isdown_last_item_at(payload: Any) -> str | None:
    return str(payload.get("last_reviewed_at") or "") or None if isinstance(payload, dict) else None


def _component_status_from_cm_connect(payload: dict[str, Any] | None) -> tuple[str, str]:
    if not isinstance(payload, dict):
        return "degraded", "CM connect endpoint unavailable."

    avg_load = _to_float(payload.get("avg_load"))
    max_load = _to_float(payload.get("max_load"))
    sample_count = int(payload.get("sample_count") or 0)
    if avg_load is None or max_load is None:
        return "degraded", f"CM load sample incomplete ({sample_count} endpoints)."
    if max_load >= 95 or avg_load >= 90:
        return "major outage", f"High CM load (avg {avg_load:.1f}% / max {max_load:.1f}%)."
    if max_load >= 85 or avg_load >= 75:
        return "degraded", f"Elevated CM load (avg {avg_load:.1f}% / max {max_load:.1f}%)."
    return "operational", f"CM load stable (avg {avg_load:.1f}% / max {max_load:.1f}%)."


def _component_status_from_cm_list(payload: dict[str, Any] | None) -> tuple[str, str]:
    if not isinstance(payload, dict):
        return "degraded", "CM directory endpoint unavailable."
    total_endpoints = int(payload.get("total_endpoints") or 0)
    if total_endpoints < 5:
        return "degraded", f"Low CM endpoint count ({total_endpoints})."
    return "operational", f"{total_endpoints} CM endpoints listed."


def _status_rank(value: str | None) -> int:
    normalized = _normalize_outage_status_text(value)
    if normalized == "major outage":
        return 2
    if normalized == "degraded":
        return 1
    if normalized == "operational":
        return 0
    return 1


def _build_official_signal(
    *,
    server_info: dict[str, Any] | None,
    cm_connect: dict[str, Any] | None,
    cm_list: dict[str, Any] | None,
    store_probe: dict[str, Any] | None,
    community_probe: dict[str, Any] | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], str, int]:
    components: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []

    def add_component(name: str, status: str, health: str, updated_at: str | None, source: str, url: str) -> None:
        components.append(
            {
                "name": name,
                "service": name,
                "status": status,
                "health": health,
                "updated_at": updated_at,
                "source": source,
                "url": url,
            }
        )
        if updated_at:
            updates.append(
                {
                    "title": f"{name}: {health}",
                    "url": url,
                    "published_at": updated_at,
                    "source": source,
                    "meta": status,
                }
            )

    if isinstance(store_probe, dict):
        add_component(
            "Steam Store",
            "operational",
            f"HTTP {store_probe.get('status_code')} in {int(store_probe.get('latency_ms') or 0)}ms.",
            str(store_probe.get("checked_at") or ""),
            "Steam Store",
            STEAM_STORE_URL,
        )
    else:
        add_component(
            "Steam Store",
            "major outage",
            "HTTP probe failed.",
            _utc_now_iso(),
            "Steam Store",
            STEAM_STORE_URL,
        )

    if isinstance(community_probe, dict):
        add_component(
            "Steam Community",
            "operational",
            f"HTTP {community_probe.get('status_code')} in {int(community_probe.get('latency_ms') or 0)}ms.",
            str(community_probe.get("checked_at") or ""),
            "Steam Community",
            STEAM_COMMUNITY_URL,
        )
    else:
        add_component(
            "Steam Community",
            "major outage",
            "HTTP probe failed.",
            _utc_now_iso(),
            "Steam Community",
            STEAM_COMMUNITY_URL,
        )

    if isinstance(server_info, dict):
        servertimestring = _clean(server_info.get("servertimestring"))
        health = (
            f"API reachable ({servertimestring})."
            if servertimestring
            else "API reachable."
        )
        add_component(
            "Steam Web API",
            "operational",
            health,
            str(server_info.get("checked_at") or ""),
            "Valve Web API",
            STEAM_SERVER_INFO_URL,
        )
    else:
        add_component(
            "Steam Web API",
            "major outage",
            "GetServerInfo endpoint unavailable.",
            _utc_now_iso(),
            "Valve Web API",
            STEAM_SERVER_INFO_URL,
        )

    cm_connect_status, cm_connect_health = _component_status_from_cm_connect(cm_connect)
    add_component(
        "Steam Connection Managers",
        cm_connect_status,
        cm_connect_health,
        str(cm_connect.get("checked_at") or _utc_now_iso()) if isinstance(cm_connect, dict) else _utc_now_iso(),
        "Valve Directory API",
        STEAM_CM_LIST_CONNECT_URL,
    )

    cm_list_status, cm_list_health = _component_status_from_cm_list(cm_list)
    add_component(
        "Steam CM Directory",
        cm_list_status,
        cm_list_health,
        str(cm_list.get("checked_at") or _utc_now_iso()) if isinstance(cm_list, dict) else _utc_now_iso(),
        "Valve Directory API",
        STEAM_CM_LIST_URL,
    )

    official_available_count = sum(
        1 for value in (server_info, cm_connect, cm_list, store_probe, community_probe) if isinstance(value, dict)
    )
    if official_available_count <= 0:
        return (
            {
                "source": "Valve probes",
                "source_type": "Official API/Web probe",
                "url": STEAM_SERVER_INFO_URL,
                "summary": "Official Steam probe sources are temporarily unavailable.",
                "current_status": "unknown",
                "reports_24h": None,
                "incidents": [],
                "top_reported_issues": [],
                "top_reported_issues_meta": {
                    "source": "Valve probes",
                    "kind": "component-status",
                    "mode": "unavailable",
                },
                "components": components,
            },
            updates,
            "unknown",
            0,
        )

    major_components = [
        component
        for component in components
        if _normalize_outage_status_text(component.get("status")) == "major outage"
    ]
    degraded_components = [
        component
        for component in components
        if _normalize_outage_status_text(component.get("status")) == "degraded"
    ]
    non_operational = [component for component in components if _status_rank(component.get("status")) > 0]

    if len(major_components) >= 2:
        overall_status = "major outage"
    elif len(major_components) == 1 or len(degraded_components) >= 2:
        overall_status = "degraded"
    elif len(degraded_components) == 1:
        overall_status = "degraded"
    else:
        overall_status = "operational"

    if overall_status == "operational":
        cm_avg_load = _to_float(cm_connect.get("avg_load")) if isinstance(cm_connect, dict) else None
        cm_sample_count = int(cm_connect.get("sample_count") or 0) if isinstance(cm_connect, dict) else 0
        if isinstance(cm_avg_load, float) and cm_sample_count > 0:
            summary = (
                "Valve API probes indicate Steam services are operational. "
                f"CM average load is {cm_avg_load:.1f}% across {cm_sample_count} sampled endpoints."
            )
        else:
            summary = "Valve API probes indicate Steam services are operational."
    else:
        impacted = ", ".join(component.get("name", "Unknown component") for component in non_operational[:4])
        if overall_status == "major outage":
            summary = f"Valve probes indicate widespread Steam issues affecting {impacted}."
        else:
            summary = f"Valve probes indicate partial Steam issues affecting {impacted}."

    incidents = [
        {
            "title": f"{component.get('name')}: {_clean(component.get('health')) or 'Service issue signal'}",
            "started_at": component.get("updated_at"),
            "duration": "ongoing",
            "acknowledgement": "Valve probe signal",
            "source": "Valve probes",
            "url": component.get("url"),
        }
        for component in non_operational[:8]
    ]

    top_issues = [
        {
            "label": _clean(component.get("name")) or "Steam component issue",
            "count": 1,
        }
        for component in non_operational[:8]
    ]

    return (
        {
            "source": "Valve probes",
            "source_type": "Official API/Web probe",
            "url": STEAM_SERVER_INFO_URL,
            "summary": summary,
            "summary_origin": "Valve probes",
            "current_status": overall_status,
            "current_status_origin": "Valve probes",
            "reports_24h": None,
            "incidents": incidents,
            "top_reported_issues": top_issues,
            "top_reported_issues_meta": {
                "source": "Valve probes",
                "kind": "component-status",
                "mode": "active" if non_operational else "none",
            },
            "components": components,
        },
        updates,
        overall_status,
        len(incidents),
    )


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
                "title": _clean(item.get("title")) or "Steam official probe update",
                "url": url,
                "published_at": item.get("published_at"),
                "source": _clean(item.get("source")) or "Valve probes",
                "channel": "official-probe",
                "meta": _clean(item.get("meta")) or None,
            }
        )
    updates = updates[:10]
    return {
        "summary": updates[0].get("title") if updates else "Official Steam probe updates unavailable.",
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _select_official_freshness(sources: list[dict[str, Any]]) -> str:
    rank = {"unknown": 0, "stale": 1, "warm": 2, "fresh": 3}
    best = "unknown"
    for source in sources:
        if not bool(source.get("ok")):
            continue
        kind = str(source.get("kind") or "")
        if not kind.startswith("official"):
            continue
        freshness = str(source.get("freshness") or "unknown").strip().lower()
        if rank.get(freshness, 0) > rank.get(best, 0):
            best = freshness
    return best


def _collect_payload(scoring_profile: str | None = None) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    social: list[dict[str, Any]] = []

    server_info_run = _run_steam_source(
        adapter_id="steam_server_info_api",
        name="Steam Web API (GetServerInfo)",
        kind="official-api",
        url=STEAM_SERVER_INFO_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_steam_server_info,
        item_count_fn=_single_item_count,
        last_item_at_fn=_single_last_item_at,
    )
    sources.append(server_info_run.source)

    cm_connect_run = _run_steam_source(
        adapter_id="steam_cm_list_connect_api",
        name="Steam Directory API (GetCMListForConnect)",
        kind="official-api",
        url=STEAM_CM_LIST_CONNECT_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_steam_cm_list_connect,
        item_count_fn=_cm_connect_item_count,
        last_item_at_fn=_single_last_item_at,
    )
    sources.append(cm_connect_run.source)

    cm_list_run = _run_steam_source(
        adapter_id="steam_cm_list_api",
        name="Steam Directory API (GetCMList)",
        kind="official-api",
        url=STEAM_CM_LIST_URL,
        role="official",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_steam_cm_list,
        item_count_fn=_cm_list_item_count,
        last_item_at_fn=_single_last_item_at,
    )
    sources.append(cm_list_run.source)

    store_probe_run = _run_steam_source(
        adapter_id="steam_store_probe",
        name="Steam Store",
        kind="official-web",
        url=STEAM_STORE_URL,
        role="probe",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_steam_store_probe,
        item_count_fn=_single_item_count,
        last_item_at_fn=_single_last_item_at,
    )
    sources.append(store_probe_run.source)

    community_probe_run = _run_steam_source(
        adapter_id="steam_community_probe",
        name="Steam Community",
        kind="official-web",
        url=STEAM_COMMUNITY_URL,
        role="probe",
        criticality="required",
        used_for_scoring=True,
        fetch_fn=fetch_steam_community_probe,
        item_count_fn=_single_item_count,
        last_item_at_fn=_single_last_item_at,
    )
    sources.append(community_probe_run.source)

    isdown_run = _run_steam_source(
        adapter_id="isdown_steam",
        name="IsDown (Steam)",
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

    server_info = server_info_run.data if server_info_run.ok and isinstance(server_info_run.data, dict) else None
    cm_connect = cm_connect_run.data if cm_connect_run.ok and isinstance(cm_connect_run.data, dict) else None
    cm_list = cm_list_run.data if cm_list_run.ok and isinstance(cm_list_run.data, dict) else None
    store_probe = store_probe_run.data if store_probe_run.ok and isinstance(store_probe_run.data, dict) else None
    community_probe = (
        community_probe_run.data if community_probe_run.ok and isinstance(community_probe_run.data, dict) else None
    )
    isdown_outage = isdown_run.data if isdown_run.ok and isinstance(isdown_run.data, dict) else None

    outage, official_updates, official_status_key, official_active_incident_count = _build_official_signal(
        server_info=server_info,
        cm_connect=cm_connect,
        cm_list=cm_list,
        store_probe=store_probe,
        community_probe=community_probe,
    )

    outage = _merge_secondary_outage_signal(outage, isdown_outage)
    if official_status_key != "unknown":
        outage["current_status"] = official_status_key
        outage["current_status_origin"] = "Valve probes"
    if _clean(outage.get("summary")):
        outage["summary_origin"] = "Valve probes"

    successful_sources = sum(1 for source in sources if source.get("ok"))
    if successful_sources == 0:
        health = "error"
    elif successful_sources < len(sources):
        health = "degraded"
    else:
        health = "ok"

    reports: list[dict[str, Any]] = [
        {
            "title": incident.get("title"),
            "url": incident.get("url") or f"{STEAM_SERVER_INFO_URL}#incident",
            "published_at": incident.get("started_at"),
            "source": incident.get("source") or "Valve probes",
            "meta": incident.get("acknowledgement") or incident.get("duration"),
        }
        for incident in (outage.get("incidents") or [])
        if isinstance(incident, dict)
    ]
    if isinstance(isdown_outage, dict):
        reports_24h = isdown_outage.get("reports_24h")
        reports_label = (
            f"{int(reports_24h)} user reports in 24h"
            if isinstance(reports_24h, int)
            else "IsDown outage signal"
        )
        reports.append(
            {
                "title": _clean(isdown_outage.get("summary")) or "IsDown Steam status signal",
                "url": ISDOWN_STATUS_URL,
                "published_at": isdown_outage.get("last_reviewed_at"),
                "source": "IsDown (Steam)",
                "meta": reports_label,
            }
        )
    reports = _sort_by_datetime(_dedupe_by_url(reports), field="published_at")[:12]

    news = _sort_by_datetime(_dedupe_by_url(official_updates), field="published_at")[:8]
    official = _build_official_block(official_updates)
    official_source_freshness = _select_official_freshness(sources)

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
    analytics["model_version"] = "steam-1.0"
    regions = _build_region_signals(analytics, outage, reports, news)

    generated_at = _utc_now_iso()
    known_resources = [
        {
            "title": "Steam Web API docs",
            "url": STEAM_WEB_API_DOCS_URL,
            "source": "Official",
            "meta": "Valve Developer",
            "published_at": generated_at,
        },
        {
            "title": "Steam API GetServerInfo",
            "url": STEAM_SERVER_INFO_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Steam API GetCMListForConnect",
            "url": STEAM_CM_LIST_CONNECT_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Steam API GetCMList",
            "url": STEAM_CM_LIST_URL,
            "source": "Official",
            "meta": "JSON endpoint",
            "published_at": generated_at,
        },
        {
            "title": "Steam planned maintenance FAQ",
            "url": STEAM_HELP_MAINTENANCE_URL,
            "source": "Official",
            "meta": "Steam Support",
            "published_at": generated_at,
        },
        {
            "title": "Steamstat.us community monitor",
            "url": STEAMSTAT_COMMUNITY_URL,
            "source": "Community",
            "meta": "Third-party monitor",
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
