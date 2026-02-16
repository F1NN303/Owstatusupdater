from __future__ import annotations

import datetime as dt
import re
import threading
import time
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "OW-Web-Status/1.0 (+github-actions)"}
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

_CACHE_LOCK = threading.Lock()
_CACHE_TS = 0.0
_CACHE_PAYLOAD: dict[str, Any] | None = None


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat().replace("+00:00", "Z")


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _request_text(url: str, timeout: int = REQUEST_TIMEOUT) -> str:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.text


def _request_json(url: str, timeout: int = REQUEST_TIMEOUT) -> dict[str, Any]:
    response = requests.get(url, timeout=timeout, headers=UA)
    response.raise_for_status()
    return response.json()


def _sort_by_published(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: item.get("published_at") or "", reverse=True)


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
        if len(incidents) >= 8:
            break

    return {
        "source": "StatusGator",
        "source_type": "Downdetector-like",
        "url": STATUSGATOR_URL,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": incidents,
    }


def fetch_forum_topics(category_slug: str, category_id: int, label: str, limit: int = 6) -> list[dict[str, Any]]:
    url = f"{FORUM_BASE_URL}/c/{category_slug}/{category_id}.json"
    data = _request_json(url)
    topics = data.get("topic_list", {}).get("topics", [])

    items: list[dict[str, Any]] = []
    for topic in topics[:limit]:
        slug = topic.get("slug")
        topic_id = topic.get("id")
        if not slug or not topic_id:
            continue

        published_at = topic.get("last_posted_at") or topic.get("bumped_at") or topic.get("created_at")
        meta_bits: list[str] = []
        posts_count = topic.get("posts_count")
        views = topic.get("views")
        if posts_count is not None:
            meta_bits.append(f"{posts_count} posts")
        if views is not None:
            meta_bits.append(f"{views} views")

        items.append(
            {
                "title": _clean(topic.get("title", "Untitled Topic")),
                "url": f"{FORUM_BASE_URL}/t/{slug}/{topic_id}",
                "published_at": published_at,
                "source": f"Blizzard Forums - {label}",
                "meta": " | ".join(meta_bits),
            }
        )

    return items


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

        headline = lines[-1] if lines else "View latest post on X"
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


def _collect_payload() -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    reports: list[dict[str, Any]] = []
    news: list[dict[str, Any]] = []
    social: list[dict[str, Any]] = []

    try:
        outage = fetch_statusgator_outages()
        sources.append({"name": "StatusGator", "ok": True, "error": None})
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
        sources.append({"name": "StatusGator", "ok": False, "error": str(exc)})

    for slug, category_id, label in FORUM_CATEGORIES:
        source_name = f"Blizzard Forums - {label}"
        try:
            category_items = fetch_forum_topics(slug, category_id, label)
            reports.extend(category_items)
            sources.append({"name": source_name, "ok": True, "error": None})
        except Exception as exc:  # pragma: no cover
            sources.append({"name": source_name, "ok": False, "error": str(exc)})

    try:
        news = fetch_overwatch_news()
        sources.append({"name": "Overwatch News", "ok": True, "error": None})
    except Exception as exc:  # pragma: no cover
        sources.append({"name": "Overwatch News", "ok": False, "error": str(exc)})

    try:
        social = fetch_x_updates()
        sources.append({"name": "X mirror feed", "ok": True, "error": None})
    except Exception as exc:  # pragma: no cover
        sources.append({"name": "X mirror feed", "ok": False, "error": str(exc)})

    successful_sources = sum(1 for source in sources if source["ok"])
    if successful_sources == 0:
        health = "error"
    elif successful_sources < len(sources):
        health = "degraded"
    else:
        health = "ok"

    return {
        "generated_at": _utc_now_iso(),
        "health": health,
        "outage": outage,
        "reports": _sort_by_published(reports)[:10],
        "news": _sort_by_published(news)[:10],
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
