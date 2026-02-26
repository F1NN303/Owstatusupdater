from __future__ import annotations

import re
from typing import Any, Callable

from bs4 import BeautifulSoup

from services.core.shared import (
    _clean,
    _normalize_outage_status_text,
    _parse_statusgator_service_health_series,
    _parse_statusgator_top_reported_issues,
    _sort_by_datetime,
)


def parse_statusgator_outage_html(
    html: str,
    *,
    source_url: str,
    summary_regex: str,
    synthesize_summary: Callable[[str, int | None, list[dict[str, Any]], list[dict[str, Any]]], str],
) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))
    service_health_24h, service_health_24h_meta = _parse_statusgator_service_health_series(html)

    summary_match = re.search(summary_regex, page_text, flags=re.IGNORECASE)
    summary = _clean(summary_match.group(0)) if summary_match else "Status summary unavailable."

    status_match = re.search(r"currently\s+([a-zA-Z ]+)\.", summary, flags=re.IGNORECASE)
    current_status = _clean(status_match.group(1)).lower() if status_match else "unknown"
    if current_status == "unknown" and service_health_24h:
        current_status = _normalize_outage_status_text(service_health_24h[-1].get("status_label"))

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
    if "summary unavailable" in summary.lower():
        summary = synthesize_summary(current_status, reports_24h, incidents, top_reported_issues)

    return {
        "source": "StatusGator",
        "source_type": "Downdetector-like",
        "url": source_url,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": incidents,
        "top_reported_issues": top_reported_issues,
        "top_reported_issues_meta": {
            "source": "StatusGator",
            "kind": "community-labels",
        },
        "service_health_24h": service_health_24h,
        "service_health_24h_meta": service_health_24h_meta,
    }


__all__ = ["parse_statusgator_outage_html"]

