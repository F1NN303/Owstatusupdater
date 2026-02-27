import argparse
import datetime as dt
import hashlib
import importlib
import json
import sys
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

CADENCE_MINUTES = 30
RETENTION_DAYS = 30
RSS_ITEM_LIMIT = 20
ALERT_EVENT_LIMIT = 25
VALID_SEVERITY_KEYS = {"stable", "minor", "degraded", "major", "unknown"}
SERVICE_CONFIG_DIR = ROOT / "config" / "services"
SERVICE_CONFIG_GLOBS = ("*.yaml", "*.yml")
SERVICE_CONFIG_REQUIRED_KEYS = {"label", "builder", "site_url", "data_dir", "state_path"}
BUILDER_IMPORT_TARGETS = {
    "overwatch": "services.ow_aggregator:build_dashboard_payload",
    "sony": "services.sony_aggregator:build_dashboard_payload",
    "m365": "services.m365_aggregator:build_dashboard_payload",
    "openai": "services.openai_aggregator:build_dashboard_payload",
}
DEFAULT_SERVICE_PREFERRED = "overwatch"


def _resolve_builder(builder_key: str):
    target = BUILDER_IMPORT_TARGETS.get(str(builder_key or "").strip().lower())
    if not target:
        raise ValueError(f"Unknown builder key '{builder_key}'")
    module_name, attr_name = target.split(":", 1)
    module = importlib.import_module(module_name)
    builder = getattr(module, attr_name, None)
    if not callable(builder):
        raise TypeError(f"Builder target '{target}' is not callable")
    return builder


def _parse_flat_yaml(path: Path) -> dict[str, object]:
    parsed: dict[str, object] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"Invalid line in {path}: '{raw_line}'")
        key, value_raw = line.split(":", 1)
        key = key.strip()
        value_text = value_raw.strip()
        if not key:
            raise ValueError(f"Missing key in {path}: '{raw_line}'")
        if value_text.lower() in {"true", "false"}:
            parsed[key] = value_text.lower() == "true"
            continue
        if (value_text.startswith('"') and value_text.endswith('"')) or (
            value_text.startswith("'") and value_text.endswith("'")
        ):
            parsed[key] = value_text[1:-1]
            continue
        parsed[key] = value_text
    return parsed


def _load_service_configs() -> dict[str, dict[str, object]]:
    loaded: dict[str, dict[str, object]] = {}
    if not SERVICE_CONFIG_DIR.exists():
        return loaded

    files: list[Path] = []
    for pattern in SERVICE_CONFIG_GLOBS:
        files.extend(sorted(SERVICE_CONFIG_DIR.glob(pattern)))

    for config_path in files:
        raw = _parse_flat_yaml(config_path)
        enabled = raw.get("enabled", True)
        if isinstance(enabled, str):
            enabled = enabled.strip().lower() not in {"0", "false", "no", "off"}
        if not bool(enabled):
            continue

        service_key = str(raw.get("id") or config_path.stem).strip().lower()
        missing = sorted(key for key in SERVICE_CONFIG_REQUIRED_KEYS if not str(raw.get(key) or "").strip())
        if missing:
            raise ValueError(
                f"Service config '{config_path}' is missing required keys: {', '.join(missing)}"
            )

        loaded[service_key] = {
            "label": str(raw["label"]).strip(),
            "builder": _resolve_builder(str(raw["builder"]).strip()),
            "site_url": str(raw["site_url"]).strip(),
            "data_dir": Path(str(raw["data_dir"]).strip()),
            "state_path": Path(str(raw["state_path"]).strip()),
            "source": str(config_path.relative_to(ROOT)).replace("\\", "/"),
        }
    return loaded

SERVICE_CONFIGS = _load_service_configs()
if not SERVICE_CONFIGS:
    raise RuntimeError(
        f"No enabled service configs found under {SERVICE_CONFIG_DIR}. "
        "Add config/services/*.yaml entries."
    )

ACTIVE_SERVICE_KEY = (
    DEFAULT_SERVICE_PREFERRED
    if DEFAULT_SERVICE_PREFERRED in SERVICE_CONFIGS
    else sorted(SERVICE_CONFIGS.keys())[0]
)
SERVICE_LABEL = SERVICE_CONFIGS[ACTIVE_SERVICE_KEY]["label"]
SERVICE_SITE_URL = SERVICE_CONFIGS[ACTIVE_SERVICE_KEY]["site_url"]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build static dashboard JSON data.")
    parser.add_argument(
        "--service",
        choices=sorted(SERVICE_CONFIGS.keys()),
        default=ACTIVE_SERVICE_KEY,
        help=f"Service dataset to build (default: {ACTIVE_SERVICE_KEY}).",
    )
    return parser.parse_args()


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _iso_utc(value: dt.datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _bucket_start(value: dt.datetime, cadence_minutes: int) -> dt.datetime:
    minute = (value.minute // cadence_minutes) * cadence_minutes
    return value.replace(minute=minute, second=0, microsecond=0)


def _read_history(path: Path) -> dict:
    if not path.exists():
        return {
            "updated_at": _iso_utc(dt.datetime.now(dt.UTC)),
            "cadence_minutes": CADENCE_MINUTES,
            "retention_days": RETENTION_DAYS,
            "points": [],
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    return {
        "updated_at": data.get("updated_at", _iso_utc(dt.datetime.now(dt.UTC))),
        "cadence_minutes": int(data.get("cadence_minutes", CADENCE_MINUTES)),
        "retention_days": int(data.get("retention_days", RETENTION_DAYS)),
        "points": list(data.get("points", [])),
    }


def _read_state(path: Path) -> dict:
    if not path.exists():
        return {
            "updated_at": None,
            "last_severity_key": "unknown",
            "incident_index": {},
            "report_index": {},
            "last_alert_id": None,
            "last_good_outage_snapshot": None,
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    return {
        "updated_at": data.get("updated_at"),
        "last_severity_key": data.get("last_severity_key", "unknown"),
        "incident_index": dict(data.get("incident_index", {})),
        "report_index": dict(data.get("report_index", {})),
        "last_alert_id": data.get("last_alert_id"),
        "last_good_outage_snapshot": data.get("last_good_outage_snapshot"),
    }


def _extract_last_good_outage_snapshot(payload: dict) -> dict | None:
    outage = payload.get("outage")
    if not isinstance(outage, dict):
        return None
    if str(outage.get("source") or "") != "StatusGator":
        return None

    current_status = str(outage.get("current_status") or "").strip().lower()
    reports_24h = outage.get("reports_24h")
    incidents = outage.get("incidents") if isinstance(outage.get("incidents"), list) else []
    top_reported_issues = (
        outage.get("top_reported_issues") if isinstance(outage.get("top_reported_issues"), list) else []
    )
    summary = str(outage.get("summary") or "").strip().lower()
    is_placeholder = (
        current_status in {"", "unknown"}
        and reports_24h in (None, "")
        and len(incidents) == 0
        and len(top_reported_issues) == 0
        and "temporarily unavailable" in summary
    )
    if is_placeholder:
        return None

    outage_copy = dict(outage)
    outage_copy.pop("fallback", None)
    return {
        "captured_at": payload.get("generated_at"),
        "outage": outage_copy,
    }


def _hash_id(parts: list[str]) -> str:
    raw = "|".join(parts).encode("utf-8", "ignore")
    return hashlib.sha1(raw).hexdigest()[:16]


def _normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").split())


def _build_incident_index(payload: dict) -> dict[str, dict]:
    outage = payload.get("outage") or {}
    source_url = str(outage.get("url") or "")
    index: dict[str, dict] = {}
    for incident in outage.get("incidents") or []:
        title = _normalize_text(incident.get("title"))
        started_at = str(incident.get("started_at") or "")
        duration = _normalize_text(incident.get("duration"))
        acknowledgement = _normalize_text(incident.get("acknowledgement"))
        incident_id = _hash_id(["incident", title.lower(), started_at])
        fingerprint = _hash_id(["incident_fp", duration.lower(), acknowledgement.lower()])
        index[incident_id] = {
            "id": incident_id,
            "title": title,
            "started_at": started_at,
            "duration": duration,
            "acknowledgement": acknowledgement or None,
            "url": source_url,
            "fingerprint": fingerprint,
        }
    return index


def _build_report_index(payload: dict) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for report in payload.get("reports") or []:
        title = _normalize_text(report.get("title"))
        url = str(report.get("url") or "")
        published_at = str(report.get("published_at") or "")
        source = _normalize_text(report.get("source"))
        meta = _normalize_text(report.get("meta"))
        report_id = _hash_id(["report", url.lower(), title.lower()])
        fingerprint = _hash_id(["report_fp", published_at, meta.lower()])
        index[report_id] = {
            "id": report_id,
            "title": title,
            "url": url,
            "published_at": published_at,
            "source": source,
            "meta": meta,
            "fingerprint": fingerprint,
        }
    return index


def _diff_indexes(
    previous: dict[str, dict],
    current: dict[str, dict],
    timestamp_field: str,
) -> tuple[list[dict], list[dict], list[dict]]:
    new_items: list[dict] = []
    updated_items: list[dict] = []
    resolved_items: list[dict] = []

    for key, item in current.items():
        previous_item = previous.get(key)
        if not previous_item:
            new_items.append(item)
            continue
        if previous_item.get("fingerprint") != item.get("fingerprint"):
            updated_items.append(item)

    for key, item in previous.items():
        if key not in current:
            resolved_items.append(item)

    key_fn = lambda item: _parse_iso8601(item.get(timestamp_field)) or dt.datetime.min.replace(tzinfo=dt.UTC)
    new_items.sort(key=key_fn, reverse=True)
    updated_items.sort(key=key_fn, reverse=True)
    resolved_items.sort(key=key_fn, reverse=True)
    return new_items, updated_items, resolved_items


def _build_changes(previous_state: dict, payload: dict) -> tuple[dict, dict[str, dict], dict[str, dict]]:
    current_incidents = _build_incident_index(payload)
    current_reports = _build_report_index(payload)

    def _public_entry(item: dict) -> dict:
        return {key: value for key, value in item.items() if key != "fingerprint"}

    if not previous_state.get("updated_at"):
        return (
            {
                "generated_at": payload.get("generated_at"),
                "incidents": {"new": [], "updated": [], "resolved": []},
                "reports": {"new": []},
                "summary": {
                    "new_incidents": 0,
                    "updated_incidents": 0,
                    "resolved_incidents": 0,
                    "new_reports": 0,
                },
            },
            current_incidents,
            current_reports,
        )

    previous_incidents = previous_state.get("incident_index", {})
    previous_reports = previous_state.get("report_index", {})

    incident_new, incident_updated, incident_resolved = _diff_indexes(previous_incidents, current_incidents, "started_at")
    report_new, _report_updated, _report_resolved = _diff_indexes(previous_reports, current_reports, "published_at")

    return (
        {
            "generated_at": payload.get("generated_at"),
            "incidents": {
                "new": [_public_entry(item) for item in incident_new],
                "updated": [_public_entry(item) for item in incident_updated],
                "resolved": [_public_entry(item) for item in incident_resolved],
            },
            "reports": {
                "new": [_public_entry(item) for item in report_new],
            },
            "summary": {
                "new_incidents": len(incident_new),
                "updated_incidents": len(incident_updated),
                "resolved_incidents": len(incident_resolved),
                "new_reports": len(report_new),
            },
        },
        current_incidents,
        current_reports,
    )


def _build_alert_event(kind: str, generated_at: str, title: str, message: str, severity_key: str, links: list[str]) -> dict:
    event_id = _hash_id([kind, generated_at, title, message])
    primary_link = links[0] if links else SERVICE_SITE_URL
    discord_message = f"**{title}**\n{message}\n{primary_link}"
    telegram_text = f"<b>{xml_escape(title)}</b>\n{xml_escape(message)}\n{xml_escape(primary_link)}"
    return {
        "id": event_id,
        "kind": kind,
        "title": title,
        "message": message,
        "severity_key": severity_key,
        "occurred_at": generated_at,
        "links": links,
        "relay": {
            "discord": {
                "content": discord_message,
            },
            "telegram": {
                "text": telegram_text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False,
            },
        },
    }


def _build_alerts(previous_state: dict, payload: dict, changes: dict) -> dict:
    generated_at = str(payload.get("generated_at") or _iso_utc(dt.datetime.now(dt.UTC)))
    current_severity = str((payload.get("analytics") or {}).get("severity_key") or "unknown")
    previous_severity = str(previous_state.get("last_severity_key") or "unknown")
    is_baseline = not previous_state.get("updated_at")

    events: list[dict] = []

    if not is_baseline and previous_severity != current_severity:
        events.append(
            _build_alert_event(
                "severity_transition",
                generated_at,
                "Service severity changed",
                f"Severity moved from {previous_severity} to {current_severity}.",
                current_severity,
                [str((payload.get("outage") or {}).get("url") or SERVICE_SITE_URL)],
            )
        )

    incident_new = (changes.get("incidents") or {}).get("new") or []
    incident_resolved = (changes.get("incidents") or {}).get("resolved") or []
    for item in incident_new[:2]:
        events.append(
            _build_alert_event(
                "incident_new",
                generated_at,
                "New incident detected",
                item.get("title") or "A new incident was detected.",
                current_severity,
                [str(item.get("url") or "")],
            )
        )
    for item in incident_resolved[:2]:
        events.append(
            _build_alert_event(
                "incident_resolved",
                generated_at,
                "Incident resolved",
                item.get("title") or "An incident appears resolved.",
                current_severity,
                [str(item.get("url") or "")],
            )
        )

    report_new = (changes.get("reports") or {}).get("new") or []
    for item in report_new[:2]:
        events.append(
            _build_alert_event(
                "report_new",
                generated_at,
                "New high-signal report",
                item.get("title") or "A new report appeared in the status feed.",
                current_severity,
                [str(item.get("url") or "")],
            )
        )

    events = events[:ALERT_EVENT_LIMIT]
    return {
        "generated_at": generated_at,
        "events": events,
        "unread_count": len(events),
        "webhook_examples": {
            "discord": "POST relay.discord JSON body to your Discord webhook URL.",
            "telegram": "POST relay.telegram JSON body to https://api.telegram.org/bot<token>/sendMessage.",
        },
    }


def _build_point(payload: dict, point_time: dt.datetime) -> dict:
    analytics = payload.get("analytics") or {}
    regions = payload.get("regions") or {}
    sources = payload.get("sources") or []
    reports_24h = int((payload.get("outage") or {}).get("reports_24h") or 0)

    region_snapshot: dict[str, dict] = {
        "global": {
            "reports_24h": reports_24h,
            "severity_key": analytics.get("severity_key", "unknown"),
            "severity_score": int(analytics.get("severity_score", 0) or 0),
            "report_weight": 1.0,
        }
    }
    for region_key, region_data in regions.items():
        if not isinstance(region_data, dict):
            continue
        weight = float(region_data.get("report_weight") or 0.0)
        estimated_reports = int(round(reports_24h * max(min(weight, 1.0), 0.0)))
        region_snapshot[region_key] = {
            "reports_24h": estimated_reports,
            "severity_key": region_data.get("severity_key", "unknown"),
            "severity_score": int(region_data.get("severity_score", 0) or 0),
            "report_weight": round(weight, 3),
        }

    source_states: dict[str, dict] = {}
    for source in sources:
        if not isinstance(source, dict):
            continue
        name = str(source.get("name") or "").strip()
        if not name:
            continue
        source_states[name] = {
            "ok": bool(source.get("ok")),
            "freshness": str(source.get("freshness") or "unknown"),
            "item_count": int(source.get("item_count") or 0),
            "kind": str(source.get("kind") or "unknown"),
        }

    return {
        "t": _iso_utc(point_time),
        "health": payload.get("health", "error"),
        "reports_24h": reports_24h,
        "severity_key": analytics.get("severity_key", "unknown"),
        "severity_score": int(analytics.get("severity_score", 0)),
        "source_ok": int(analytics.get("source_ok_count", 0)),
        "source_total": int(analytics.get("source_total_count", 0)),
        "regions": region_snapshot,
        "source_states": source_states,
    }


def _normalize_history_point(point: dict) -> dict | None:
    parsed = _parse_iso8601(point.get("t"))
    if not parsed:
        return None

    severity_key = str(point.get("severity_key") or "unknown")
    if severity_key not in VALID_SEVERITY_KEYS:
        severity_key = "unknown"

    reports_24h = int(point.get("reports_24h") or 0)
    severity_score = int(point.get("severity_score") or 0)
    source_ok = int(point.get("source_ok") or 0)
    source_total = int(point.get("source_total") or 0)

    raw_regions = point.get("regions") if isinstance(point.get("regions"), dict) else {}
    regions: dict[str, dict] = {}
    for region_key, region_value in raw_regions.items():
        if not isinstance(region_key, str) or not isinstance(region_value, dict):
            continue
        region_severity = str(region_value.get("severity_key") or severity_key)
        if region_severity not in VALID_SEVERITY_KEYS:
            region_severity = severity_key
        raw_region_score = region_value.get("severity_score")
        region_score = severity_score if raw_region_score is None else int(raw_region_score)
        report_weight = round(float(region_value.get("report_weight") or 0.0), 3)
        report_weight = max(min(report_weight, 1.0), 0.0)
        regions[region_key] = {
            "reports_24h": int(region_value.get("reports_24h") or 0),
            "severity_key": region_severity,
            "severity_score": region_score,
            "report_weight": report_weight,
        }

    if "global" not in regions:
        regions["global"] = {
            "reports_24h": reports_24h,
            "severity_key": severity_key,
            "severity_score": severity_score,
            "report_weight": 1.0,
        }

    raw_source_states = point.get("source_states") if isinstance(point.get("source_states"), dict) else {}
    source_states: dict[str, dict] = {}
    for source_name, source_state in raw_source_states.items():
        if not isinstance(source_name, str) or not isinstance(source_state, dict):
            continue
        freshness = str(source_state.get("freshness") or "unknown")
        if freshness not in {"fresh", "warm", "stale", "unknown"}:
            freshness = "unknown"
        source_states[source_name] = {
            "ok": bool(source_state.get("ok")),
            "freshness": freshness,
            "item_count": max(int(source_state.get("item_count") or 0), 0),
            "kind": str(source_state.get("kind") or "unknown"),
        }

    return {
        "t": _iso_utc(parsed),
        "health": str(point.get("health") or "error"),
        "reports_24h": reports_24h,
        "severity_key": severity_key,
        "severity_score": severity_score,
        "source_ok": max(source_ok, 0),
        "source_total": max(source_total, 0),
        "regions": regions,
        "source_states": source_states,
    }


def _dedupe_and_merge_points(points: list[dict], point: dict) -> list[dict]:
    by_time: dict[str, dict] = {}
    for existing in points:
        normalized = _normalize_history_point(existing)
        if not normalized:
            continue
        by_time[normalized["t"]] = normalized
    normalized_point = _normalize_history_point(point)
    if normalized_point:
        by_time[normalized_point["t"]] = normalized_point
    merged = list(by_time.values())
    merged.sort(key=lambda item: _parse_iso8601(item.get("t")) or dt.datetime.min.replace(tzinfo=dt.UTC))
    return merged


def _prune_points(points: list[dict], now: dt.datetime, retention_days: int) -> list[dict]:
    cutoff = now - dt.timedelta(days=retention_days)
    kept: list[dict] = []
    for point in points:
        parsed = _parse_iso8601(point.get("t"))
        if not parsed:
            continue
        if parsed >= cutoff:
            kept.append(point)
    return kept


def _build_summary(payload: dict, history: dict) -> dict:
    analytics = payload.get("analytics") or {}
    outage = payload.get("outage") or {}
    official = payload.get("official") or {}
    changes = payload.get("changes") or {}
    change_summary = changes.get("summary") or {}
    points = history.get("points") or []
    latest_point = points[-1] if points else {}

    return {
        "generated_at": payload.get("generated_at"),
        "health": payload.get("health", "error"),
        "severity_key": analytics.get("severity_key", "unknown"),
        "severity_score": int(analytics.get("severity_score", 0) or 0),
        "reports_24h": int(outage.get("reports_24h") or 0),
        "outage_summary": outage.get("summary", ""),
        "source_agreement": {
            "ok": int(analytics.get("source_ok_count", 0) or 0),
            "total": int(analytics.get("source_total_count", 0) or 0),
        },
        "regions": payload.get("regions") or {},
        "official_last_statement_at": official.get("last_statement_at"),
        "change_summary": {
            "new_incidents": int(change_summary.get("new_incidents", 0) or 0),
            "updated_incidents": int(change_summary.get("updated_incidents", 0) or 0),
            "resolved_incidents": int(change_summary.get("resolved_incidents", 0) or 0),
            "new_reports": int(change_summary.get("new_reports", 0) or 0),
        },
        "history_points": len(points),
        "history_last_point_at": latest_point.get("t"),
        "links": {
            "status": "./status.json",
            "history": "./history.json",
            "alerts": "./alerts.json",
            "rss": "./rss.xml",
        },
    }


def _build_rss_items(payload: dict) -> list[dict]:
    items: list[dict] = []
    outage = payload.get("outage") or {}

    for incident in outage.get("incidents") or []:
        started_at = incident.get("started_at")
        items.append(
            {
                "title": f"[Incident] {incident.get('title') or 'Service incident'}",
                "link": outage.get("url") or SERVICE_SITE_URL,
                "published_at": started_at,
                "description": f"Duration: {incident.get('duration') or 'n/a'}",
            }
        )

    for update in (payload.get("official") or {}).get("updates") or []:
        items.append(
            {
                "title": f"[Official] {update.get('title') or 'Official update'}",
                "link": update.get("url") or "",
                "published_at": update.get("published_at"),
                "description": f"Source: {update.get('source') or 'Official'}",
            }
        )

    for report in payload.get("reports") or []:
        items.append(
            {
                "title": f"[Community] {report.get('title') or 'Status report'}",
                "link": report.get("url") or "",
                "published_at": report.get("published_at"),
                "description": f"Source: {report.get('source') or 'Community'}",
            }
        )

    deduped: dict[tuple[str, str], dict] = {}
    for item in items:
        key = (str(item.get("title") or ""), str(item.get("link") or ""))
        deduped[key] = item

    sorted_items = sorted(
        deduped.values(),
        key=lambda item: _parse_iso8601(item.get("published_at")) or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )
    return sorted_items[:RSS_ITEM_LIMIT]


def _to_rfc2822(iso_value: str | None) -> str:
    parsed = _parse_iso8601(iso_value)
    if not parsed:
        parsed = dt.datetime.now(dt.UTC)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.UTC)
    return format_datetime(parsed)


def _build_rss(payload: dict) -> str:
    generated_at = payload.get("generated_at") or _iso_utc(dt.datetime.now(dt.UTC))
    items_xml: list[str] = []
    for item in _build_rss_items(payload):
        title = xml_escape(str(item.get("title") or f"{SERVICE_LABEL} status update"))
        link = xml_escape(str(item.get("link") or SERVICE_SITE_URL))
        description = xml_escape(str(item.get("description") or f"{SERVICE_LABEL} service status update"))
        pub_date = xml_escape(_to_rfc2822(item.get("published_at")))
        items_xml.append(
            "\n".join(
                [
                    "    <item>",
                    f"      <title>{title}</title>",
                    f"      <link>{link}</link>",
                    f"      <guid>{link}</guid>",
                    f"      <pubDate>{pub_date}</pubDate>",
                    f"      <description>{description}</description>",
                    "    </item>",
                ]
            )
        )

    channel_pub_date = xml_escape(_to_rfc2822(generated_at))
    channel_items = "\n".join(items_xml)
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<rss version=\"2.0\">",
            "  <channel>",
            f"    <title>{xml_escape(SERVICE_LABEL)} Service Radar Updates</title>",
            f"    <link>{xml_escape(SERVICE_SITE_URL)}</link>",
            f"    <description>Latest {xml_escape(SERVICE_LABEL)} outage, official, and community status updates.</description>",
            f"    <lastBuildDate>{channel_pub_date}</lastBuildDate>",
            channel_items,
            "  </channel>",
            "</rss>",
            "",
        ]
    )


def main(service_key: str = "overwatch") -> None:
    config = SERVICE_CONFIGS.get(service_key)
    if not config:
        raise SystemExit(f"Unsupported service: {service_key}")

    global ACTIVE_SERVICE_KEY
    global SERVICE_LABEL
    global SERVICE_SITE_URL
    ACTIVE_SERVICE_KEY = service_key
    SERVICE_LABEL = str(config["label"])
    SERVICE_SITE_URL = str(config["site_url"])

    now = dt.datetime.now(dt.UTC)
    data_dir = Path(config["data_dir"])
    data_dir.mkdir(parents=True, exist_ok=True)
    state_path = Path(config.get("state_path") or (data_dir / "state.json"))
    state_path.parent.mkdir(parents=True, exist_ok=True)
    previous_state = _read_state(state_path)

    builder_kwargs: dict = {"force_refresh": True}
    if service_key == "overwatch" and previous_state.get("last_good_outage_snapshot"):
        builder_kwargs["previous_outage_fallback"] = previous_state.get("last_good_outage_snapshot")

    payload = config["builder"](**builder_kwargs)

    changes, incident_index, report_index = _build_changes(previous_state, payload)
    payload["changes"] = changes
    alerts = _build_alerts(previous_state, payload, changes)

    status_path = data_dir / "status.json"
    status_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    history_path = data_dir / "history.json"
    history = _read_history(history_path)
    history["cadence_minutes"] = CADENCE_MINUTES
    history["retention_days"] = RETENTION_DAYS

    point_time = _bucket_start(now, CADENCE_MINUTES)
    new_point = _build_point(payload, point_time)
    merged_points = _dedupe_and_merge_points(history.get("points", []), new_point)
    history["points"] = _prune_points(merged_points, now, RETENTION_DAYS)
    history["updated_at"] = _iso_utc(now)

    history_path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    summary_path = data_dir / "summary.json"
    summary_path.write_text(json.dumps(_build_summary(payload, history), ensure_ascii=False, indent=2), encoding="utf-8")

    rss_path = data_dir / "rss.xml"
    rss_path.write_text(_build_rss(payload), encoding="utf-8")
    alerts_path = data_dir / "alerts.json"
    alerts_path.write_text(json.dumps(alerts, ensure_ascii=False, indent=2), encoding="utf-8")

    next_last_good_outage_snapshot = previous_state.get("last_good_outage_snapshot")
    if service_key == "overwatch":
        extracted = _extract_last_good_outage_snapshot(payload)
        if extracted:
            next_last_good_outage_snapshot = extracted

    state = {
        "updated_at": _iso_utc(now),
        "last_severity_key": str((payload.get("analytics") or {}).get("severity_key") or "unknown"),
        "incident_index": incident_index,
        "report_index": report_index,
        "last_alert_id": alerts.get("events", [{}])[0].get("id") if alerts.get("events") else previous_state.get("last_alert_id"),
        "last_good_outage_snapshot": next_last_good_outage_snapshot,
    }
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[{service_key}] wrote {status_path} with health={payload.get('health')}")
    print(f"[{service_key}] wrote {history_path} with points={len(history['points'])}")
    print(f"[{service_key}] wrote {summary_path}")
    print(f"[{service_key}] wrote {rss_path}")
    print(f"[{service_key}] wrote {alerts_path} with events={len(alerts.get('events', []))}")
    print(f"[{service_key}] wrote {state_path}")


if __name__ == "__main__":
    args = _parse_args()
    main(args.service)
