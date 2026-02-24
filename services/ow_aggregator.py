from __future__ import annotations

import datetime as dt
import html as html_lib
import re
import threading
import time
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "OW-Web-Status/2.0 (+github-actions)"}
REQUEST_TIMEOUT = 20
CACHE_TTL_SECONDS = 120

STATUSGATOR_URL = "https://statusgator.com/services/overwatch-2"
FORUM_BASE_URL = "https://us.forums.blizzard.com/en/overwatch"
OVERWATCH_NEWS_URL = "https://overwatch.blizzard.com/en-us/news/"
X_MIRROR_URL = "https://r.jina.ai/http://x.com/PlayOverwatch"

FORUM_CATEGORIES = [
    ("technical-support", 8, "Technical Support"),
    ("bug-report", 9, "Bug Report"),
]

FORUM_MAX_AGE_DAYS = 30
FORUM_SKIP_TITLE_KEYWORDS = ("guideline", "unable to post", "common technical issues")

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

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat().replace("+00:00", "Z")


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
    if any(token in text for token in ("Ã", "â", "€™", "œ", "ž", "�")):
        try:
            repaired = text.encode("latin-1", "ignore").decode("utf-8", "ignore")
            if repaired:
                text = repaired
        except Exception:
            pass
    if any(token in text for token in ("â€™", "â€œ", "â€", "ðŸ")):
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


def _request_text(url: str, timeout: int = REQUEST_TIMEOUT) -> str:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.text


def _request_json(url: str, timeout: int = REQUEST_TIMEOUT) -> dict[str, Any]:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.json()


def _sort_by_datetime(items: list[dict[str, Any]], field: str = "published_at") -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: _parse_iso8601(item.get(field)) or dt.datetime.min.replace(tzinfo=dt.UTC), reverse=True)


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

        items.append(
            {
                "label": label,
                "count": count,
            }
        )
        if len(items) >= 8:
            break

    return items


def fetch_statusgator_outages() -> dict[str, Any]:
    html = _request_text(STATUSGATOR_URL)
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))

    summary_match = re.search(
        r"StatusGator reports that Overwatch 2 is currently .*?past 24 hours\.",
        page_text,
        flags=re.IGNORECASE,
    )
    summary = _clean(summary_match.group(0)) if summary_match else "Status summary unavailable."

    status_match = re.search(r"currently\s+([a-zA-Z ]+)\.", summary, flags=re.IGNORECASE)
    current_status = _clean(status_match.group(1)).lower() if status_match else "unknown"

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
    return {
        "source": "StatusGator",
        "source_type": "Downdetector-like",
        "url": STATUSGATOR_URL,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": incidents,
        "top_reported_issues": top_reported_issues,
    }


def _topic_timestamp(topic: dict[str, Any]) -> str | None:
    return topic.get("last_posted_at") or topic.get("bumped_at") or topic.get("created_at")


def fetch_forum_topics(
    category_slug: str,
    category_id: int,
    label: str,
    limit: int = 8,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    url = f"{FORUM_BASE_URL}/c/{category_slug}/{category_id}.json"
    data = _request_json(url)
    topics = data.get("topic_list", {}).get("topics", [])

    now = _utc_now()
    items: list[dict[str, Any]] = []
    known_resources: list[dict[str, Any]] = []

    for topic in topics:
        slug = topic.get("slug")
        topic_id = topic.get("id")
        if not slug or not topic_id:
            continue

        title = _clean(topic.get("title", "Untitled Topic"))
        title_lower = title.lower()
        published_at = _topic_timestamp(topic)
        published_dt = _parse_iso8601(published_at)
        age_days = (now - published_dt).days if published_dt else None

        posts_count = topic.get("posts_count")
        views = topic.get("views")
        meta_bits: list[str] = []
        if posts_count is not None:
            meta_bits.append(f"{posts_count} posts")
        if views is not None:
            meta_bits.append(f"{views} views")

        item = {
            "title": title,
            "url": f"{FORUM_BASE_URL}/t/{slug}/{topic_id}",
            "published_at": published_at,
            "source": f"Blizzard Forums - {label}",
            "meta": " | ".join(meta_bits),
        }

        if "known issues" in title_lower or "known technical support issues" in title_lower:
            known_resources.append(item)

        is_pinned = bool(topic.get("pinned") or topic.get("pinned_globally"))
        is_guideline = any(keyword in title_lower for keyword in FORUM_SKIP_TITLE_KEYWORDS)
        too_old = age_days is not None and age_days > FORUM_MAX_AGE_DAYS

        if is_pinned or is_guideline or too_old:
            continue

        items.append(item)
        if len(items) >= limit:
            break

    return items, known_resources


def fetch_overwatch_news(limit: int = 8) -> list[dict[str, Any]]:
    html = _request_text(OVERWATCH_NEWS_URL)
    soup = BeautifulSoup(html, "html.parser")

    news_items: list[dict[str, Any]] = []
    seen_links: set[str] = set()
    for anchor in soup.select('a[slot="gallery-items"]'):
        href = anchor.get("href")
        if not href:
            continue
        full_url = urljoin(OVERWATCH_NEWS_URL, href)
        if full_url in seen_links:
            continue
        seen_links.add(full_url)

        heading = anchor.select_one('h3[slot="heading"]')
        timestamp_node = anchor.select_one("blz-timestamp")
        title = _clean(heading.get_text(" ", strip=True)) if heading else ""
        published_at = timestamp_node.get("timestamp") if timestamp_node else None
        if not title:
            continue

        news_items.append(
            {
                "title": title,
                "url": full_url,
                "published_at": published_at,
                "source": "Overwatch News",
                "meta": None,
            }
        )
        if len(news_items) >= limit:
            break

    return news_items


def fetch_x_updates(limit: int = 4) -> list[dict[str, Any]]:
    text = _request_text(X_MIRROR_URL)
    ids = re.findall(r"https://x\.com/PlayOverwatch/status/(\d+)", text, flags=re.IGNORECASE)
    unique_ids: list[str] = []
    seen: set[str] = set()
    for status_id in ids:
        if status_id in seen:
            continue
        seen.add(status_id)
        unique_ids.append(status_id)
        if len(unique_ids) >= limit:
            break

    items: list[dict[str, Any]] = []
    for status_id in unique_ids:
        link = f"https://x.com/PlayOverwatch/status/{status_id}"
        idx = text.find(link)
        snippet = text[max(0, idx - 700) : idx] if idx >= 0 else text[:700]

        lines: list[str] = []
        for raw_line in snippet.splitlines():
            line = _clean(raw_line)
            if not line:
                continue
            if line.startswith("["):
                continue
            if line.lower().startswith(
                (
                    "title:",
                    "url source:",
                    "published time:",
                    "markdown content:",
                    "overwatch's posts",
                    "who to follow",
                    "@playoverwatch",
                    "pinned",
                    "quote",
                )
            ):
                continue
            lines.append(line)

        headline = "View latest post on X"

        items.append(
            {
                "title": headline,
                "url": link,
                "published_at": None,
                "source": "X - PlayOverwatch (mirror)",
                "meta": "Mirror feed, may be delayed",
            }
        )

    return items


def _calculate_severity(
    outage: dict[str, Any],
    sources: list[dict[str, Any]],
    health: str,
    reports: list[dict[str, Any]],
    news: list[dict[str, Any]],
    social: list[dict[str, Any]],
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

    score = max(score, 0.0)
    severity_key = _score_to_severity(score, source_total_count)

    return {
        "severity_key": severity_key,
        "severity_score": int(round(score)),
        "source_ok_count": source_ok_count,
        "source_total_count": source_total_count,
        "model_version": SEVERITY_MODEL_VERSION,
        "score_breakdown": {
            "reports": round(report_contribution, 3),
            "incidents": round(incident_contribution, 3),
            "source_health": round(health_contribution, 3),
            "corroboration_bonus": round(corroboration_bonus, 3),
            "support_score": round(support_score, 3),
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
            # Blend global severity with region-specific evidence without over-amplifying sparse hits.
            region_score = (base_score * 0.65) + (base_score * 1.15 * weight)
        region_score = max(min(region_score, 12.0), 0.0)
        regions[region] = {
            "severity_key": _score_to_severity(region_score, 1),
            "severity_score": int(round(region_score)),
            "report_weight": round(weight, 3),
        }
    return regions


def _build_official_block(known_resources: list[dict[str, Any]], news: list[dict[str, Any]]) -> dict[str, Any]:
    updates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for item in _sort_by_datetime(news, field="published_at"):
        url = str(item.get("url") or "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        updates.append(
            {
                "title": _clean(item.get("title")),
                "url": url,
                "published_at": item.get("published_at"),
                "source": "Overwatch News",
                "channel": "official-news",
            }
        )

    for item in _sort_by_datetime(known_resources, field="published_at"):
        url = str(item.get("url") or "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        updates.append(
            {
                "title": _clean(item.get("title")),
                "url": url,
                "published_at": item.get("published_at"),
                "source": str(item.get("source") or "Blizzard Forums"),
                "channel": "official-forum",
            }
        )

    updates = _sort_by_datetime(updates, field="published_at")[:10]
    return {
        "updates": updates,
        "last_statement_at": updates[0].get("published_at") if updates else None,
    }


def _collect_payload() -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []
    known_resources: list[dict[str, Any]] = []
    news: list[dict[str, Any]] = []
    social: list[dict[str, Any]] = []

    started = time.perf_counter()
    try:
        outage = fetch_statusgator_outages()
        last_item_at = _latest_timestamp(outage.get("incidents") or [], "started_at")
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

    for slug, category_id, label in FORUM_CATEGORIES:
        source_name = f"Blizzard Forums - {label}"
        started = time.perf_counter()
        try:
            category_items, category_known = fetch_forum_topics(slug, category_id, label)
            reports.extend(category_items)
            known_resources.extend(category_known)
            last_item_at = _latest_timestamp(category_items, "published_at")
            freshness, age_minutes = _source_freshness(last_item_at)
            sources.append(
                {
                    "name": source_name,
                    "kind": "community-forum",
                    "url": f"{FORUM_BASE_URL}/c/{slug}/{category_id}",
                    "ok": True,
                    "error": None,
                    "item_count": len(category_items),
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
                    "name": source_name,
                    "kind": "community-forum",
                    "url": f"{FORUM_BASE_URL}/c/{slug}/{category_id}",
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
        news = fetch_overwatch_news()
        last_item_at = _latest_timestamp(news, "published_at")
        freshness, age_minutes = _source_freshness(last_item_at)
        sources.append(
            {
                "name": "Overwatch News",
                "kind": "official-news",
                "url": OVERWATCH_NEWS_URL,
                "ok": True,
                "error": None,
                "item_count": len(news),
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
                "name": "Overwatch News",
                "kind": "official-news",
                "url": OVERWATCH_NEWS_URL,
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
                "name": "X mirror feed",
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
                "name": "X mirror feed",
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

    successful_sources = sum(1 for source in sources if source["ok"])
    if successful_sources == 0:
        health = "error"
    elif successful_sources < len(sources):
        health = "degraded"
    else:
        health = "ok"

    sorted_reports = _sort_by_datetime(_dedupe_by_url(reports), field="published_at")[:10]
    sorted_known_resources = _sort_by_datetime(_dedupe_by_url(known_resources), field="published_at")[:5]
    sorted_news = _sort_by_datetime(news, field="published_at")[:10]
    analytics = _calculate_severity(outage, sources, health, sorted_reports, sorted_news, social[:6])
    official = _build_official_block(sorted_known_resources, sorted_news)
    regions = _build_region_signals(analytics, outage, sorted_reports, sorted_news)

    return {
        "generated_at": _utc_now_iso(),
        "health": health,
        "analytics": analytics,
        "regions": regions,
        "official": official,
        "outage": outage,
        "reports": sorted_reports,
        "known_resources": sorted_known_resources,
        "news": sorted_news,
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
