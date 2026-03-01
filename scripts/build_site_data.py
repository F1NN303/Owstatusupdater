import argparse
import datetime as dt
import hashlib
import importlib
import inspect
import json
import re
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
DEFAULT_SERVICE_PREFERRED = "overwatch"
SOURCE_RELIABILITY_RETENTION_HOURS = 7 * 24
SOURCE_RELIABILITY_WINDOW_HOURS = 24
SOURCE_RELIABILITY_MAX_RUNS = 500
SOURCE_FRESHNESS_OK = {"fresh", "warm"}
SOURCE_ROLE_VALUES = {"official", "provider", "community", "social", "probe"}
SOURCE_CRITICALITY_VALUES = {"required", "supporting", "optional"}


def _resolve_builder(builder_target: str):
    target = str(builder_target or "").strip()
    if ":" not in target:
        raise ValueError(
            f"Invalid builder target '{builder_target}'. "
            "Expected format 'module.path:function_name'."
        )
    module_name, attr_name = target.split(":", 1)
    module_name = module_name.strip()
    attr_name = attr_name.strip()
    if not module_name or not attr_name:
        raise ValueError(
            f"Invalid builder target '{builder_target}'. "
            "Expected format 'module.path:function_name'."
        )
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


def _parse_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return default


def _parse_csv_list(value: object) -> list[str]:
    if isinstance(value, (list, tuple)):
        out = [str(item).strip() for item in value if str(item).strip()]
        return out
    text = str(value or "").strip()
    if not text:
        return []
    return [part.strip() for part in text.split(",") if part.strip()]


def _parse_int(value: object, default: int | None = None) -> int | None:
    if value is None:
        return default
    try:
        return int(str(value).strip())
    except Exception:
        return default


def _service_sort_key(service_id: str) -> tuple[int, str]:
    return (
        _parse_int(SERVICE_CONFIGS.get(service_id, {}).get("home_order"), default=9999),
        service_id,
    )


def _data_dir_to_status_path(data_dir: Path) -> str:
    normalized = data_dir.as_posix().strip("/")
    if normalized.startswith("site/"):
        normalized = normalized[len("site/") :]
    normalized = normalized.strip("/")
    if not normalized:
        return "/status.json"
    return f"/{normalized}/status.json"


def _build_services_manifest_payload() -> dict:
    services: list[dict[str, object]] = []
    service_keys = sorted(SERVICE_CONFIGS.keys(), key=_service_sort_key)
    for service_id in service_keys:
        config = SERVICE_CONFIGS[service_id]
        if _parse_bool(config.get("home_enabled"), default=True) is False:
            continue
        detail_path = str(config.get("detail_path") or f"/status/{service_id}").strip() or f"/status/{service_id}"
        status_path = str(config.get("status_path") or _data_dir_to_status_path(Path(config["data_dir"]))).strip()
        aliases = _parse_csv_list(config.get("aliases"))
        aliases_lower: list[str] = []
        seen_aliases: set[str] = set()
        for alias in [service_id, *aliases]:
            lowered = str(alias).strip().lower()
            if not lowered or lowered in seen_aliases:
                continue
            seen_aliases.add(lowered)
            aliases_lower.append(lowered)

        tags = _parse_csv_list(config.get("tags"))
        tags_lower: list[str] = []
        seen_tags: set[str] = set()
        for tag in tags:
            lowered = str(tag).strip().lower()
            if not lowered or lowered in seen_tags:
                continue
            seen_tags.add(lowered)
            tags_lower.append(lowered)

        priority = _parse_int(config.get("priority"), default=None)
        if priority is None:
            priority = _parse_int(config.get("home_order"), default=1000)
        category = str(config.get("category") or "general").strip().lower() or "general"

        services.append(
            {
                "id": service_id,
                "label": str(config.get("label") or service_id),
                "name": str(config.get("display_name") or config.get("label") or service_id),
                "detail_path": detail_path,
                "status_path": status_path,
                "legacy_href": str(config.get("legacy_href") or "").strip() or None,
                "note": str(config.get("note") or "").strip() or None,
                "icon": str(config.get("icon") or "").strip() or None,
                "aliases": aliases_lower,
                "category": category,
                "priority": priority,
                "tags": tags_lower,
            }
        )

    return {
        "schema_version": 1,
        "services": services,
    }


def _write_services_manifest() -> Path:
    manifest_path = ROOT / "site" / "data" / "services-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_payload = _build_services_manifest_payload()
    manifest_path.write_text(
        json.dumps(manifest_payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return manifest_path


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
            "scoring_profile": str(raw.get("scoring_profile") or "").strip() or None,
            "display_name": str(raw.get("display_name") or "").strip() or None,
            "legacy_href": str(raw.get("legacy_href") or "").strip() or None,
            "detail_path": str(raw.get("detail_path") or "").strip() or None,
            "status_path": str(raw.get("status_path") or "").strip() or None,
            "icon": str(raw.get("icon") or "").strip() or None,
            "aliases": _parse_csv_list(raw.get("aliases")),
            "note": str(raw.get("note") or "").strip() or None,
            "category": str(raw.get("category") or "").strip().lower() or None,
            "priority": _parse_int(raw.get("priority"), default=None),
            "tags": _parse_csv_list(raw.get("tags")),
            "home_enabled": _parse_bool(raw.get("home_enabled"), default=True),
            "home_order": _parse_int(raw.get("home_order"), default=None),
            "source": str(config_path.relative_to(ROOT)).replace("\\", "/"),
        }
    return loaded


def _invoke_builder(builder, kwargs: dict[str, object]) -> dict:
    signature = inspect.signature(builder)
    params = signature.parameters
    accepts_kwargs = any(param.kind == inspect.Parameter.VAR_KEYWORD for param in params.values())
    if accepts_kwargs:
        return builder(**kwargs)

    filtered_kwargs: dict[str, object] = {}
    for key, value in kwargs.items():
        if key in params:
            filtered_kwargs[key] = value
    return builder(**filtered_kwargs)

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
    service_choices = sorted(SERVICE_CONFIGS.keys()) + ["all"]
    parser.add_argument(
        "--service",
        choices=service_choices,
        default=ACTIVE_SERVICE_KEY,
        help=f"Service dataset to build, or 'all' (default: {ACTIVE_SERVICE_KEY}).",
    )
    parser.add_argument(
        "--allow-partial-success",
        action="store_true",
        help=(
            "When used with '--service all', continue if one service fails and exit 0. "
            "Without this flag, any failed service returns exit code 1."
        ),
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
            "source_reliability": {},
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
        "source_reliability": dict(data.get("source_reliability", {})),
    }


def _slugify_source_id(value: str | None) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return normalized[:64]


def _normalize_source_role(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in SOURCE_ROLE_VALUES:
        return normalized
    return "provider"


def _normalize_source_criticality(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in SOURCE_CRITICALITY_VALUES:
        return normalized
    return "supporting"


def _normalize_source_freshness(value: object) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"fresh", "warm", "stale", "unknown"}:
        return normalized
    return "unknown"


def _prune_source_runs(raw_runs: object, now: dt.datetime) -> list[dict[str, object]]:
    if not isinstance(raw_runs, list):
        return []

    cutoff = now - dt.timedelta(hours=SOURCE_RELIABILITY_RETENTION_HOURS)
    runs: list[dict[str, object]] = []
    for run in raw_runs:
        if not isinstance(run, dict):
            continue
        at_text = str(run.get("at") or "").strip()
        parsed_at = _parse_iso8601(at_text)
        if not parsed_at or parsed_at < cutoff:
            continue
        duration_ms = _parse_int(run.get("duration_ms"), default=None)
        if isinstance(duration_ms, int):
            duration_ms = max(duration_ms, 0)
        runs.append(
            {
                "at": _iso_utc(parsed_at),
                "ok": bool(run.get("ok")),
                "freshness": _normalize_source_freshness(run.get("freshness")),
                "duration_ms": duration_ms,
                "cache_hit": bool(run.get("cache_hit")),
            }
        )

    runs.sort(key=lambda item: _parse_iso8601(item.get("at")) or dt.datetime.min.replace(tzinfo=dt.UTC))
    if len(runs) > SOURCE_RELIABILITY_MAX_RUNS:
        runs = runs[-SOURCE_RELIABILITY_MAX_RUNS:]
    return runs


def _source_window_metrics(runs: list[dict[str, object]], now: dt.datetime, window_hours: int) -> dict[str, object]:
    cutoff = now - dt.timedelta(hours=max(window_hours, 1))
    selected = [
        run
        for run in runs
        if (_parse_iso8601(run.get("at")) or dt.datetime.min.replace(tzinfo=dt.UTC)) >= cutoff
    ]
    total = len(selected)
    ok_count = sum(1 for run in selected if bool(run.get("ok")))
    stale_count = sum(1 for run in selected if _normalize_source_freshness(run.get("freshness")) not in SOURCE_FRESHNESS_OK)
    cache_hit_count = sum(1 for run in selected if bool(run.get("cache_hit")))

    durations: list[int] = []
    for run in selected:
        duration_ms = _parse_int(run.get("duration_ms"), default=None)
        if isinstance(duration_ms, int) and duration_ms >= 0:
            durations.append(duration_ms)

    return {
        "runs": total,
        "ok": ok_count,
        "stale": stale_count,
        "success_rate": round((ok_count / total) * 100, 1) if total > 0 else None,
        "stale_rate": round((stale_count / total) * 100, 1) if total > 0 else None,
        "cache_hit_rate": round((cache_hit_count / total) * 100, 1) if total > 0 else None,
        "avg_duration_ms": round(sum(durations) / len(durations), 1) if durations else None,
    }


def _source_consecutive_failures(runs: list[dict[str, object]]) -> int:
    count = 0
    for run in reversed(runs):
        if bool(run.get("ok")):
            break
        count += 1
    return count


def _build_source_reliability_state(
    previous_state: dict[str, object],
    sources: object,
    now: dt.datetime,
) -> tuple[dict[str, dict[str, object]], list[str]]:
    previous_map = previous_state.get("source_reliability")
    previous_reliability = previous_map if isinstance(previous_map, dict) else {}
    now_iso = _iso_utc(now)
    output: dict[str, dict[str, object]] = {}
    ordered_ids: list[str] = []
    seen_ids: set[str] = set()

    rows = sources if isinstance(sources, list) else []
    for index, raw_source in enumerate(rows):
        if not isinstance(raw_source, dict):
            continue

        source_name = str(raw_source.get("name") or "").strip() or f"Source {index + 1}"
        source_id = _slugify_source_id(raw_source.get("source_id") or source_name) or f"source-{index + 1}"
        base_source_id = source_id
        suffix = 2
        while source_id in seen_ids:
            source_id = f"{base_source_id}-{suffix}"
            suffix += 1
        seen_ids.add(source_id)
        ordered_ids.append(source_id)

        previous_entry = previous_reliability.get(source_id)
        previous_runs = _prune_source_runs(
            previous_entry.get("runs") if isinstance(previous_entry, dict) else None,
            now,
        )

        duration_ms = _parse_int(raw_source.get("duration_ms"), default=None)
        if isinstance(duration_ms, int):
            duration_ms = max(duration_ms, 0)
        previous_runs.append(
            {
                "at": now_iso,
                "ok": bool(raw_source.get("ok")),
                "freshness": _normalize_source_freshness(raw_source.get("freshness")),
                "duration_ms": duration_ms,
                "cache_hit": bool(raw_source.get("cache_hit")),
            }
        )
        runs = _prune_source_runs(previous_runs, now)

        last_success_at = None
        last_failure_at = None
        for run in reversed(runs):
            if last_success_at is None and bool(run.get("ok")):
                last_success_at = run.get("at")
            if last_failure_at is None and not bool(run.get("ok")):
                last_failure_at = run.get("at")
            if last_success_at and last_failure_at:
                break

        output[source_id] = {
            "source_id": source_id,
            "name": source_name,
            "kind": str(raw_source.get("kind") or "unknown"),
            "url": str(raw_source.get("url") or ""),
            "role": _normalize_source_role(raw_source.get("role")),
            "criticality": _normalize_source_criticality(raw_source.get("criticality")),
            "used_for_scoring": bool(raw_source.get("used_for_scoring", True)),
            "runs": runs,
            "last_success_at": last_success_at,
            "last_failure_at": last_failure_at,
            "updated_at": now_iso,
        }

    return output, ordered_ids


def _build_source_transparency(
    payload: dict[str, object],
    source_reliability: dict[str, dict[str, object]],
    source_order: list[str],
    now: dt.datetime,
) -> dict[str, object]:
    analytics = payload.get("analytics") if isinstance(payload.get("analytics"), dict) else {}
    total_sources = 0
    ok_sources = 0
    fresh_sources = 0
    required_total = 0
    required_ok = 0
    required_fresh = 0
    scoring_total = 0
    scoring_ok = 0
    recent_success_ratios: list[float] = []
    max_consecutive_failures = 0
    source_rows: list[dict[str, object]] = []

    for source_id in source_order:
        entry = source_reliability.get(source_id)
        if not isinstance(entry, dict):
            continue
        runs = entry.get("runs") if isinstance(entry.get("runs"), list) else []
        latest = runs[-1] if runs else {}
        latest_ok = bool(latest.get("ok"))
        latest_freshness = _normalize_source_freshness(latest.get("freshness"))
        latest_fresh = latest_freshness in SOURCE_FRESHNESS_OK

        total_sources += 1
        if latest_ok:
            ok_sources += 1
        if latest_fresh:
            fresh_sources += 1

        role = _normalize_source_role(entry.get("role"))
        criticality = _normalize_source_criticality(entry.get("criticality"))
        used_for_scoring = bool(entry.get("used_for_scoring", True))
        if criticality == "required":
            required_total += 1
            if latest_ok:
                required_ok += 1
            if latest_fresh:
                required_fresh += 1
        if used_for_scoring:
            scoring_total += 1
            if latest_ok:
                scoring_ok += 1

        metrics_24h = _source_window_metrics(runs, now, SOURCE_RELIABILITY_WINDOW_HOURS)
        metrics_7d = _source_window_metrics(runs, now, SOURCE_RELIABILITY_RETENTION_HOURS)
        success_24h = metrics_24h.get("success_rate")
        if isinstance(success_24h, (int, float)):
            recent_success_ratios.append(float(success_24h) / 100.0)
        else:
            recent_success_ratios.append(1.0 if latest_ok else 0.0)

        consecutive_failures = _source_consecutive_failures(runs)
        max_consecutive_failures = max(max_consecutive_failures, consecutive_failures)

        source_rows.append(
            {
                "source_id": source_id,
                "name": str(entry.get("name") or source_id),
                "kind": str(entry.get("kind") or "unknown"),
                "url": str(entry.get("url") or ""),
                "role": role,
                "criticality": criticality,
                "used_for_scoring": used_for_scoring,
                "latest": {
                    "ok": latest_ok,
                    "freshness": latest_freshness,
                    "duration_ms": _parse_int(latest.get("duration_ms"), default=None),
                    "cache_hit": bool(latest.get("cache_hit")),
                    "at": latest.get("at"),
                },
                "metrics_24h": metrics_24h,
                "metrics_7d": metrics_7d,
                "consecutive_failures": consecutive_failures,
                "last_success_at": entry.get("last_success_at"),
                "last_failure_at": entry.get("last_failure_at"),
            }
        )

    if total_sources > 0:
        required_ratio = (required_ok / required_total) if required_total > 0 else (ok_sources / total_sources)
        scoring_ratio = (scoring_ok / scoring_total) if scoring_total > 0 else required_ratio
        recent_success_ratio = sum(recent_success_ratios) / max(len(recent_success_ratios), 1)
        freshness_ratio = fresh_sources / total_sources
        confidence_score = round(
            (required_ratio * 0.45 + scoring_ratio * 0.25 + recent_success_ratio * 0.20 + freshness_ratio * 0.10)
            * 100.0,
            1,
        )
    else:
        required_ratio = 0.0
        scoring_ratio = 0.0
        recent_success_ratio = 0.0
        freshness_ratio = 0.0
        confidence_score = 0.0

    if confidence_score >= 85:
        confidence_tier = "high"
    elif confidence_score >= 65:
        confidence_tier = "medium"
    else:
        confidence_tier = "low"

    required_met = required_total == 0 or required_ok == required_total
    scoring_required_min = max(1, int((scoring_total * 0.6) + 0.999)) if scoring_total > 0 else 0
    scoring_met = scoring_total == 0 or scoring_ok >= scoring_required_min

    degraded_reasons: list[str] = []
    if total_sources == 0:
        degraded_reasons.append("no_sources_configured")
    if required_total > 0 and required_ok < required_total:
        degraded_reasons.append("required_source_failure")
    if ok_sources < total_sources:
        degraded_reasons.append("partial_source_failure")
    if required_total > 0 and required_fresh < required_total:
        degraded_reasons.append("required_source_stale")
    if freshness_ratio < 0.7 and total_sources > 0:
        degraded_reasons.append("stale_source_data")
    if recent_success_ratio < 0.7 and total_sources > 0:
        degraded_reasons.append("low_recent_success_rate")
    if max_consecutive_failures >= 3:
        degraded_reasons.append("repeated_source_failures")

    if degraded_reasons:
        explanation = (
            "Reliability constraints detected: "
            + ", ".join(reason.replace("_", " ") for reason in degraded_reasons[:3])
            + "."
        )
    else:
        explanation = "All configured sources are healthy and recently refreshed."

    return {
        "schema_version": 1,
        "generated_at": payload.get("generated_at") or _iso_utc(now),
        "overview": {
            "confidence_score": confidence_score,
            "confidence_tier": confidence_tier,
            "source_ok": ok_sources,
            "source_total": total_sources,
            "required_ok": required_ok,
            "required_total": required_total,
            "required_met": required_met,
            "scoring_ok": scoring_ok,
            "scoring_total": scoring_total,
            "scoring_met": scoring_met,
            "degraded_reasons": degraded_reasons,
            "ratios": {
                "required_ratio": round(required_ratio, 3),
                "scoring_ratio": round(scoring_ratio, 3),
                "recent_success_ratio": round(recent_success_ratio, 3),
                "freshness_ratio": round(freshness_ratio, 3),
            },
        },
        "decision": {
            "health": str(payload.get("health") or "error"),
            "severity_key": str(analytics.get("severity_key") or "unknown"),
            "explanation": explanation,
        },
        "sources": source_rows,
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
        source_id = _slugify_source_id(source.get("source_id") or source.get("name"))
        name = str(source.get("name") or source_id or "").strip()
        if not source_id:
            continue
        source_states[source_id] = {
            "name": name,
            "source_id": source_id,
            "ok": bool(source.get("ok")),
            "freshness": _normalize_source_freshness(source.get("freshness")),
            "item_count": int(source.get("item_count") or 0),
            "kind": str(source.get("kind") or "unknown"),
            "role": _normalize_source_role(source.get("role")),
            "criticality": _normalize_source_criticality(source.get("criticality")),
            "used_for_scoring": bool(source.get("used_for_scoring", True)),
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
        source_id = _slugify_source_id(source_state.get("source_id") or source_name)
        if not source_id:
            continue
        freshness = _normalize_source_freshness(source_state.get("freshness"))
        source_states[source_id] = {
            "name": str(source_state.get("name") or source_name),
            "source_id": source_id,
            "ok": bool(source_state.get("ok")),
            "freshness": freshness,
            "item_count": max(int(source_state.get("item_count") or 0), 0),
            "kind": str(source_state.get("kind") or "unknown"),
            "role": _normalize_source_role(source_state.get("role")),
            "criticality": _normalize_source_criticality(source_state.get("criticality")),
            "used_for_scoring": bool(source_state.get("used_for_scoring", True)),
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


def _service_keys_for_build(service_key: str) -> list[str]:
    normalized = str(service_key or "").strip().lower()
    if normalized == "all":
        return sorted(SERVICE_CONFIGS.keys(), key=_service_sort_key)
    if normalized in SERVICE_CONFIGS:
        return [normalized]
    raise ValueError(f"Unsupported service: {service_key}")


def _build_single_service(service_key: str, manifest_path: Path) -> None:
    config = SERVICE_CONFIGS.get(service_key)
    if not config:
        raise ValueError(f"Unsupported service: {service_key}")

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
    scoring_profile = config.get("scoring_profile")
    if isinstance(scoring_profile, str) and scoring_profile.strip():
        builder_kwargs["scoring_profile"] = scoring_profile.strip()

    payload = _invoke_builder(config["builder"], builder_kwargs)
    source_reliability, source_reliability_order = _build_source_reliability_state(
        previous_state,
        payload.get("sources"),
        now,
    )
    payload["source_transparency"] = _build_source_transparency(
        payload,
        source_reliability,
        source_reliability_order,
        now,
    )

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
        "source_reliability": source_reliability,
    }
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[{service_key}] wrote {status_path} with health={payload.get('health')}")
    print(f"[{service_key}] wrote {history_path} with points={len(history['points'])}")
    print(f"[{service_key}] wrote {summary_path}")
    print(f"[{service_key}] wrote {rss_path}")
    print(f"[{service_key}] wrote {alerts_path} with events={len(alerts.get('events', []))}")
    print(f"[{service_key}] wrote {state_path}")
    print(f"[{service_key}] wrote {manifest_path.relative_to(ROOT)}")


def main(service_key: str = ACTIVE_SERVICE_KEY, allow_partial_success: bool = False) -> int:
    service_keys = _service_keys_for_build(service_key)
    manifest_path = _write_services_manifest()

    failures: list[tuple[str, str]] = []
    for key in service_keys:
        try:
            _build_single_service(key, manifest_path)
        except Exception as exc:
            failures.append((key, str(exc)))
            print(f"[{key}] build failed: {exc}")

    if failures:
        print("[build] one or more services failed:")
        for failed_key, reason in failures:
            print(f"[build] - {failed_key}: {reason}")
        if allow_partial_success and str(service_key or "").strip().lower() == "all":
            print("[build] partial success enabled; continuing with exit code 0")
            return 0
        return 1
    return 0


if __name__ == "__main__":
    args = _parse_args()
    raise SystemExit(main(args.service, allow_partial_success=args.allow_partial_success))
