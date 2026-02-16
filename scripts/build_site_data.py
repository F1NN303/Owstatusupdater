import datetime as dt
import json
import sys
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ow_aggregator import build_dashboard_payload

CADENCE_MINUTES = 30
RETENTION_DAYS = 30
RSS_ITEM_LIMIT = 20


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


def _build_summary(payload: dict, history: dict) -> dict:
    analytics = payload.get("analytics") or {}
    outage = payload.get("outage") or {}
    official = payload.get("official") or {}
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
        "history_points": len(points),
        "history_last_point_at": latest_point.get("t"),
        "links": {
            "status": "./status.json",
            "history": "./history.json",
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
                "link": outage.get("url") or "https://statusgator.com/services/overwatch-2",
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
        title = xml_escape(str(item.get("title") or "Overwatch status update"))
        link = xml_escape(str(item.get("link") or "https://f1nn303.github.io/Owstatusupdater/"))
        description = xml_escape(str(item.get("description") or "Overwatch service status update"))
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
            "    <title>Overwatch Service Radar Updates</title>",
            "    <link>https://f1nn303.github.io/Owstatusupdater/</link>",
            "    <description>Latest Overwatch outage, official, and community status updates.</description>",
            f"    <lastBuildDate>{channel_pub_date}</lastBuildDate>",
            channel_items,
            "  </channel>",
            "</rss>",
            "",
        ]
    )


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
    summary_path = data_dir / "summary.json"
    summary_path.write_text(json.dumps(_build_summary(payload, history), ensure_ascii=False, indent=2), encoding="utf-8")

    rss_path = data_dir / "rss.xml"
    rss_path.write_text(_build_rss(payload), encoding="utf-8")

    print(f"Wrote {status_path} with health={payload.get('health')}")
    print(f"Wrote {history_path} with points={len(history['points'])}")
    print(f"Wrote {summary_path}")
    print(f"Wrote {rss_path}")


if __name__ == "__main__":
    main()
