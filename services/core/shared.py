from __future__ import annotations

import copy
import datetime as dt
import html as html_lib
import json
import re
from typing import Any

from bs4 import BeautifulSoup
from services.profiles.scoring_profiles import apply_scoring_profile

SEVERITY_CRITICAL_KEYWORDS = (
    "service down",
    "major outage",
    "unavailable",
    "cannot connect",
    "unable to connect",
    "server outage",
)
SEVERITY_WARNING_KEYWORDS = ("lag", "latency", "disconnect", "queue", "degraded", "maintenance")
SEVERITY_SCORE_THRESHOLDS = {
    "stable_max": 2.4,
    "minor_max": 4.8,
    "degraded_max": 8.0,
}
SEVERITY_INCIDENT_SCORE_CAP = 5.5
SEVERITY_MODEL_VERSION = "2.4"
SOURCE_FRESH_MINUTES_FRESH = 120
SOURCE_FRESH_MINUTES_WARM = 24 * 60
REGION_KEYWORDS = {
    "eu": ("eu", "europe", "emea", "germany", "france", "uk", "netherlands", "poland", "sweden"),
    "na": ("na", "north america", "usa", "us", "canada", "mexico", "west coast", "east coast"),
    "apac": ("apac", "asia", "oceania", "australia", "japan", "korea", "singapore", "hong kong"),
}
STATUSGATOR_SERVICE_HEALTH_STATUS_LABELS = {
    0: "service up",
    1: "possible outage",
    2: "likely outage",
}


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _hours_since(value: str | None) -> float | None:
    parsed = _parse_iso8601(value)
    if not parsed:
        return None
    delta = _utc_now() - parsed
    return max(delta.total_seconds() / 3600.0, 0.0)


def _repair_text_encoding(value: str) -> str:
    text = value
    if any(token in text for token in ("Ãƒ", "Ã¢", "â‚¬â„¢", "Å“", "Å¾", "ï¿½")):
        try:
            repaired = text.encode("latin-1", "ignore").decode("utf-8", "ignore")
            if repaired:
                text = repaired
        except Exception:
            pass
    if any(token in text for token in ("Ã¢â‚¬â„¢", "Ã¢â‚¬Å“", "Ã¢â‚¬", "Ã°Å¸")):
        try:
            repaired = text.encode("latin-1", "ignore").decode("utf-8", "ignore")
            if repaired:
                text = repaired
        except Exception:
            pass
    return text


def _clean(text: str | None) -> str:
    if not text:
        return ""
    cleaned = html_lib.unescape(text)
    cleaned = _repair_text_encoding(cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _sort_by_datetime(items: list[dict[str, Any]], field: str = "published_at") -> list[dict[str, Any]]:
    return sorted(
        items,
        key=lambda item: _parse_iso8601(item.get(field)) or dt.datetime.min.replace(tzinfo=dt.UTC),
        reverse=True,
    )


def _dedupe_by_url(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        key = str(item.get("url") or "")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(item)
    return out


def _score_to_severity(score: float, source_total_count: int = 1) -> str:
    if source_total_count <= 0:
        return "unknown"
    if score < SEVERITY_SCORE_THRESHOLDS["stable_max"]:
        return "stable"
    if score < SEVERITY_SCORE_THRESHOLDS["minor_max"]:
        return "minor"
    if score < SEVERITY_SCORE_THRESHOLDS["degraded_max"]:
        return "degraded"
    return "major"


def _count_keyword_hits(text: str, keywords: tuple[str, ...]) -> int:
    hits = 0
    for keyword in keywords:
        pattern = rf"\b{re.escape(keyword)}\b"
        if re.search(pattern, text):
            hits += 1
    return hits


def _extract_posts_count(meta: str | None) -> int:
    if not meta:
        return 0
    match = re.search(r"(\d+)\s+posts?", str(meta), flags=re.IGNORECASE)
    if not match:
        return 0
    return int(match.group(1))


def _keyword_signal_weight(text: str) -> float:
    lowered = _clean(text).lower()
    critical = _count_keyword_hits(lowered, SEVERITY_CRITICAL_KEYWORDS)
    warning = _count_keyword_hits(lowered, SEVERITY_WARNING_KEYWORDS)
    return (critical * 1.15) + (warning * 0.45)


def _collect_cross_source_signal(
    reports: list[dict[str, Any]],
    news: list[dict[str, Any]],
    social: list[dict[str, Any]],
) -> dict[str, float]:
    report_score = 0.0
    report_hits_24h = 0
    for item in reports:
        age_h = _hours_since(item.get("published_at"))
        if age_h is None or age_h > 72:
            continue
        signal = _keyword_signal_weight(f"{item.get('title') or ''} {item.get('meta') or ''}")
        if signal <= 0:
            continue
        if age_h <= 6:
            recency = 1.0
            report_hits_24h += 1
        elif age_h <= 24:
            recency = 0.68
            report_hits_24h += 1
        else:
            recency = 0.32
        crowd = min(_extract_posts_count(item.get("meta")) / 60.0, 1.0) * 0.35
        report_score += (signal * recency * 0.52) + crowd

    news_score = 0.0
    for item in news:
        age_h = _hours_since(item.get("published_at"))
        if age_h is None or age_h > 7 * 24:
            continue
        signal = _keyword_signal_weight(item.get("title") or "")
        if signal <= 0:
            continue
        recency = 1.0 if age_h <= 24 else 0.45
        news_score += signal * recency * 0.4

    social_score = 0.0
    for item in social:
        signal = _keyword_signal_weight(item.get("title") or "")
        if signal <= 0:
            continue
        social_score += signal * 0.25

    return {
        "report_score": round(report_score, 3),
        "news_score": round(news_score, 3),
        "social_score": round(social_score, 3),
        "combined_score": round(report_score + news_score + social_score, 3),
        "report_hits_24h": report_hits_24h,
    }


def _latest_timestamp(items: list[dict[str, Any]], *fields: str) -> str | None:
    latest: dt.datetime | None = None
    latest_raw: str | None = None
    for item in items:
        for field in fields:
            raw = item.get(field)
            parsed = _parse_iso8601(raw)
            if not parsed:
                continue
            if latest is None or parsed > latest:
                latest = parsed
                latest_raw = raw
    return latest_raw


def _source_freshness(last_item_at: str | None) -> tuple[str, int | None]:
    age_h = _hours_since(last_item_at)
    if age_h is None:
        return "unknown", None
    age_minutes = int(max(age_h * 60.0, 0.0))
    if age_minutes <= SOURCE_FRESH_MINUTES_FRESH:
        return "fresh", age_minutes
    if age_minutes <= SOURCE_FRESH_MINUTES_WARM:
        return "warm", age_minutes
    return "stale", age_minutes


def _safe_error_message(exc: Exception) -> str:
    msg = str(exc).strip().splitlines()[0] if exc else "unknown error"
    return _clean(msg)[:220]


def _parse_statusgator_service_health_series(html: str) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    match = re.search(r"var\s+data\s*=\s*(\[[\s\S]*?\]);", html, flags=re.IGNORECASE)
    if not match:
        return [], None
    try:
        raw_points = json.loads(match.group(1))
    except json.JSONDecodeError:
        return [], None

    points: list[dict[str, Any]] = []
    for row in raw_points if isinstance(raw_points, list) else []:
        if not isinstance(row, dict):
            continue
        timestamp = row.get("five_min")
        value_raw = row.get("interpolated_sum_value")
        status_raw = row.get("status")
        parsed_ts = _parse_iso8601(str(timestamp) if timestamp else None)
        if parsed_ts is None:
            continue
        try:
            value = float(value_raw)
        except (TypeError, ValueError):
            continue
        try:
            status_code = int(status_raw)
        except (TypeError, ValueError):
            status_code = 0
        points.append(
            {
                "timestamp": parsed_ts.isoformat().replace("+00:00", "Z"),
                "signal_value": round(max(value, 0.0), 3),
                "status_code": status_code,
                "status_label": STATUSGATOR_SERVICE_HEALTH_STATUS_LABELS.get(status_code, "unknown"),
            }
        )

    if not points:
        return [], None

    interval_minutes: int | None = None
    if len(points) >= 2:
        first = _parse_iso8601(points[0].get("timestamp"))
        second = _parse_iso8601(points[1].get("timestamp"))
        if first and second:
            interval_minutes = int(abs((second - first).total_seconds()) // 60)
    meta = {
        "source": "StatusGator",
        "kind": "service-health-series",
        "window_hours": 24,
        "sample_count": len(points),
        "interval_minutes": interval_minutes,
        "last_sample_at": points[-1].get("timestamp"),
    }
    return points[-192:], meta


def _normalize_outage_status_text(value: str | None) -> str:
    text = _clean(value).lower()
    if not text:
        return "unknown"
    if any(token in text for token in ("operational", "service up", "up", "online", "ok")):
        return "operational"
    if any(token in text for token in ("likely outage", "major outage", "down", "offline")):
        return "major outage"
    if any(token in text for token in ("possible outage", "degraded", "issue", "maintenance")):
        return "degraded"
    return text


def _merge_secondary_outage_signal(primary: dict[str, Any], secondary: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(primary, dict) or not isinstance(secondary, dict):
        return primary

    merged = copy.deepcopy(primary)
    primary_summary = _clean(merged.get("summary"))
    secondary_summary = _clean(secondary.get("summary"))
    if (not primary_summary or "summary unavailable" in primary_summary.lower()) and secondary_summary:
        merged["summary"] = secondary_summary
        merged["summary_origin"] = "IsDown"

    primary_status = _normalize_outage_status_text(merged.get("current_status"))
    secondary_status = _normalize_outage_status_text(secondary.get("current_status"))
    if primary_status == "unknown" and secondary_status != "unknown":
        merged["current_status"] = secondary_status

    if merged.get("reports_24h") in (None, "") and isinstance(secondary.get("reports_24h"), int):
        merged["reports_24h"] = int(secondary["reports_24h"])
        merged["reports_24h_origin"] = "IsDown"

    if not isinstance(merged.get("user_reports_24h"), list) and isinstance(secondary.get("user_reports_24h"), list):
        merged["user_reports_24h"] = copy.deepcopy(secondary.get("user_reports_24h"))
        if isinstance(secondary.get("user_reports_24h_meta"), dict):
            merged["user_reports_24h_meta"] = copy.deepcopy(secondary.get("user_reports_24h_meta"))

    if not isinstance(merged.get("secondary_sources"), list):
        merged["secondary_sources"] = []
    merged["secondary_sources"].append(
        {
            "source": "IsDown",
            "available": True,
            "reports_24h": secondary.get("reports_24h"),
            "last_reviewed_at": secondary.get("last_reviewed_at"),
        }
    )
    return merged


def _parse_statusgator_top_reported_issues(soup: BeautifulSoup) -> list[dict[str, Any]]:
    heading = None
    for candidate in soup.find_all(["h2", "h3", "h4"]):
        heading_text = _clean(candidate.get_text(" ", strip=True)).lower()
        if "top reported issues" in heading_text:
            heading = candidate
            break

    if heading is None:
        return []

    issue_list = heading.find_next("ul")
    if issue_list is None:
        return []

    items: list[dict[str, Any]] = []
    seen_labels: set[str] = set()
    for row in issue_list.find_all("li", recursive=False):
        label = _clean(row.get("aria-label"))

        if not label:
            for span in row.find_all("span"):
                candidate = _clean(span.get_text(" ", strip=True))
                if not candidate:
                    continue
                if re.fullmatch(r"\d+", candidate):
                    continue
                if len(candidate) <= 2 and candidate.lower() in {"ok", "up"}:
                    continue
                label = candidate
                break

        x_data = str(row.get("x-data") or "")
        count: int | None = None
        x_data_match = re.search(r"initialCount\s*:\s*(\d+)", x_data)
        if x_data_match:
            count = int(x_data_match.group(1))
        else:
            count_candidates = re.findall(r"\b(\d+)\b", _clean(row.get_text(" ", strip=True)))
            if count_candidates:
                count = int(count_candidates[-1])

        if not label:
            continue

        normalized_label = label.casefold()
        if normalized_label in seen_labels:
            continue
        seen_labels.add(normalized_label)

        items.append({"label": label, "count": count})
        if len(items) >= 8:
            break

    return items


def _calculate_severity(
    outage: dict[str, Any],
    sources: list[dict[str, Any]],
    health: str,
    reports: list[dict[str, Any]],
    news: list[dict[str, Any]],
    social: list[dict[str, Any]],
    scoring_profile: str | None = None,
    scoring_profile_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    score = 0.0
    reports_24h = int(outage.get("reports_24h") or 0)
    incidents = outage.get("incidents") or []
    incident_score = 0.0
    recent_incidents_6h = 0
    recent_incidents_24h = 0

    report_contribution = 0.0
    if reports_24h >= 1800:
        report_contribution = 2.8
    elif reports_24h >= 1200:
        report_contribution = 2.0
    elif reports_24h >= 700:
        report_contribution = 1.2
    elif reports_24h >= 350:
        report_contribution = 0.6
    score += report_contribution

    for incident in incidents:
        title = str(incident.get("title") or "").lower()
        age_h = _hours_since(incident.get("started_at"))
        if age_h is not None and age_h <= 6:
            recent_incidents_6h += 1
        if age_h is not None and age_h <= 24:
            recent_incidents_24h += 1

        if age_h is None:
            age_weight = 0.3
        elif age_h <= 3:
            age_weight = 2.2
        elif age_h <= 6:
            age_weight = 1.8
        elif age_h <= 24:
            age_weight = 1.0
        elif age_h <= 72:
            age_weight = 0.35
        else:
            age_weight = 0.1

        keyword_weight = 0.0
        if any(keyword in title for keyword in SEVERITY_CRITICAL_KEYWORDS):
            keyword_weight = 1.1
        elif any(keyword in title for keyword in SEVERITY_WARNING_KEYWORDS):
            keyword_weight = 0.45

        if age_h is None or age_h <= 24:
            keyword_factor = 1.0
        elif age_h <= 72:
            keyword_factor = 0.3
        else:
            keyword_factor = 0.1

        incident_score += age_weight + (keyword_weight * keyword_factor)

    incident_cap = SEVERITY_INCIDENT_SCORE_CAP
    if reports_24h < 900 and recent_incidents_24h <= 1:
        incident_cap = min(incident_cap, 3.8)
    incident_contribution = min(incident_score, incident_cap)
    score += incident_contribution

    health_contribution = 0.0
    if health == "degraded":
        health_contribution = 0.35
    elif health == "error":
        health_contribution = 0.8
    score += health_contribution

    source_total_count = len(sources)
    source_ok_count = sum(1 for source in sources if source.get("ok"))
    source_ratio = (source_ok_count / source_total_count) if source_total_count else 0.0

    guard_operational = False
    current_status_text = str(outage.get("current_status") or "").lower()
    if "operational" in current_status_text:
        guard_operational = True
        score -= 1.8
        if recent_incidents_24h <= 1:
            score -= 0.7
        if reports_24h < 900:
            score -= 0.5

    support = _collect_cross_source_signal(reports, news, social)
    support_score = float(support.get("combined_score") or 0.0)
    corroboration_bonus = 0.0
    cross_source_guard = False
    if support_score >= 2.2:
        corroboration_bonus = 0.9
    elif support_score >= 1.1:
        corroboration_bonus = 0.4
    else:
        if "operational" in current_status_text and reports_24h < 1200 and recent_incidents_24h <= 2:
            score -= 1.2
            cross_source_guard = True
    if support_score < 0.5 and recent_incidents_6h == 0:
        score -= 0.5
        cross_source_guard = True
    score += corroboration_bonus

    low_volume_guard = False
    if reports_24h < 150 and len(incidents) <= 1 and source_ok_count >= max(source_total_count - 1, 1):
        score -= 0.5
        low_volume_guard = True
    if reports_24h < 250 and recent_incidents_24h == 0:
        score -= 0.7
        low_volume_guard = True
    if source_ratio >= 0.8 and support_score < 0.8 and reports_24h < 1000:
        score -= 0.5
        cross_source_guard = True

    score = max(score, 0.0)
    severity_key = _score_to_severity(score, source_total_count)

    major_cap_applied = False
    false_positive_cap_applied = False
    if (
        severity_key == "major"
        and "operational" in current_status_text
        and support_score < 1.2
        and recent_incidents_6h <= 1
        and reports_24h < 1700
    ):
        score = min(score, SEVERITY_SCORE_THRESHOLDS["degraded_max"] - 0.05)
        major_cap_applied = True
    if (
        _score_to_severity(score, source_total_count) in ("degraded", "major")
        and "operational" in current_status_text
        and support_score < 0.8
        and recent_incidents_6h == 0
        and reports_24h < 700
    ):
        score = min(score, SEVERITY_SCORE_THRESHOLDS["minor_max"] - 0.05)
        false_positive_cap_applied = True

    profile_context = dict(scoring_profile_context or {})
    profile_context.setdefault("reports_24h", reports_24h)
    profile_context.setdefault("recent_incidents_6h", recent_incidents_6h)
    profile_context.setdefault("support_score", support_score)
    profile_context.setdefault("stable_max", SEVERITY_SCORE_THRESHOLDS["stable_max"])
    profile_context.setdefault("minor_max", SEVERITY_SCORE_THRESHOLDS["minor_max"])
    profile_context.setdefault("degraded_max", SEVERITY_SCORE_THRESHOLDS["degraded_max"])
    profile_result = apply_scoring_profile(
        scoring_profile,
        score=score,
        context=profile_context,
    )
    score = max(float(profile_result.get("score", score)), 0.0)
    profile_adjustment = float(profile_result.get("score_adjustment") or 0.0)
    profile_safeguards = profile_result.get("safeguards")
    if isinstance(profile_safeguards, dict):
        for key, value in profile_safeguards.items():
            safeguards_value = bool(value)
            if key in ("official_operational_cap_applied", "official_active_incident_floor_applied", "profile_unrecognized"):
                # merged into final safeguards map below
                pass
            profile_safeguards[key] = safeguards_value
    else:
        profile_safeguards = {}

    severity_key = _score_to_severity(score, source_total_count)

    return {
        "severity_key": severity_key,
        "severity_score": int(round(score)),
        "source_ok_count": source_ok_count,
        "source_total_count": source_total_count,
        "model_version": SEVERITY_MODEL_VERSION,
        "scoring_profile": str(scoring_profile or "default"),
        "score_breakdown": {
            "reports": round(report_contribution, 3),
            "incidents": round(incident_contribution, 3),
            "source_health": round(health_contribution, 3),
            "corroboration_bonus": round(corroboration_bonus, 3),
            "support_score": round(support_score, 3),
            "profile_adjustment": round(profile_adjustment, 3),
        },
        "signal_metrics": {
            "reports_24h": reports_24h,
            "recent_incidents_6h": recent_incidents_6h,
            "recent_incidents_24h": recent_incidents_24h,
            "cross_source": support,
        },
        "safeguards": {
            "operational_dampening": guard_operational,
            "cross_source_guard": cross_source_guard,
            "low_volume_guard": low_volume_guard,
            "major_cap_applied": major_cap_applied,
            "false_positive_cap_applied": false_positive_cap_applied,
            "recency_decay": True,
            "official_operational_cap_applied": bool(profile_safeguards.get("official_operational_cap_applied", False)),
            "official_active_incident_floor_applied": bool(profile_safeguards.get("official_active_incident_floor_applied", False)),
            "profile_unrecognized": bool(profile_safeguards.get("profile_unrecognized", False)),
        },
    }


def _build_region_signals(
    analytics: dict[str, Any],
    outage: dict[str, Any],
    reports: list[dict[str, Any]],
    news: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    snippets: list[str] = []
    snippets.append(_clean(outage.get("summary")))
    for incident in outage.get("incidents") or []:
        snippets.append(_clean(incident.get("title")))
    for report in reports:
        snippets.append(_clean(report.get("title")))
    for item in news:
        snippets.append(_clean(item.get("title")))

    corpus = " ".join(snippets).lower()
    base_score = float(analytics.get("severity_score") or 0)
    region_hits = {region: _count_keyword_hits(corpus, keywords) for region, keywords in REGION_KEYWORDS.items()}
    total_hits = sum(region_hits.values())

    regions: dict[str, dict[str, Any]] = {}
    for region, hits in region_hits.items():
        if total_hits <= 0:
            weight = 1.0 / max(len(REGION_KEYWORDS), 1)
            region_score = base_score
        else:
            weight = hits / total_hits
            region_score = (base_score * 0.65) + (base_score * 1.15 * weight)
        region_score = max(min(region_score, 12.0), 0.0)
        regions[region] = {
            "severity_key": _score_to_severity(region_score, 1),
            "severity_score": int(round(region_score)),
            "report_weight": round(weight, 3),
        }
    return regions


__all__ = [
    "_build_region_signals",
    "_calculate_severity",
    "_clean",
    "_dedupe_by_url",
    "_latest_timestamp",
    "_merge_secondary_outage_signal",
    "_normalize_outage_status_text",
    "_parse_statusgator_service_health_series",
    "_parse_statusgator_top_reported_issues",
    "_safe_error_message",
    "_sort_by_datetime",
    "_source_freshness",
]
