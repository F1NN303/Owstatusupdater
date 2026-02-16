import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ow_aggregator import build_dashboard_payload

CADENCE_MINUTES = 30
RETENTION_DAYS = 30


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


def _build_point(payload: dict, point_time: dt.datetime) -> dict:
    analytics = payload.get("analytics") or {}
    return {
        "t": _iso_utc(point_time),
        "health": payload.get("health", "error"),
        "reports_24h": int((payload.get("outage") or {}).get("reports_24h") or 0),
        "severity_key": analytics.get("severity_key", "unknown"),
        "severity_score": int(analytics.get("severity_score", 0)),
        "source_ok": int(analytics.get("source_ok_count", 0)),
        "source_total": int(analytics.get("source_total_count", 0)),
    }


def _dedupe_and_merge_points(points: list[dict], point: dict) -> list[dict]:
    by_time: dict[str, dict] = {}
    for existing in points:
        t_value = existing.get("t")
        if not t_value:
            continue
        by_time[t_value] = existing
    by_time[point["t"]] = point
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


def main() -> None:
    now = dt.datetime.now(dt.UTC)
    payload = build_dashboard_payload(force_refresh=True)

    data_dir = Path("site/data")
    data_dir.mkdir(parents=True, exist_ok=True)

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

    print(f"Wrote {status_path} with health={payload.get('health')}")
    print(f"Wrote {history_path} with points={len(history['points'])}")


if __name__ == "__main__":
    main()
