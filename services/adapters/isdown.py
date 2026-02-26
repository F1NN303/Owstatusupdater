from __future__ import annotations

import json
import re
from typing import Any, Callable

from bs4 import BeautifulSoup

from services.core.shared import _clean


def parse_isdown_outage_html(
    html: str,
    *,
    source_url: str,
    extract_status_text: Callable[[str], tuple[str, str]],
) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = _clean(soup.get_text(" ", strip=True))

    chart_match = re.search(
        r"UserReportsChart\.create\('myChart',\s*(\[[\s\S]*?\])\s*,",
        html,
        flags=re.IGNORECASE,
    )
    chart_points: list[dict[str, Any]] = []
    if chart_match:
        try:
            raw_chart = json.loads(chart_match.group(1))
        except json.JSONDecodeError:
            raw_chart = []
        for row in raw_chart if isinstance(raw_chart, list) else []:
            if not isinstance(row, dict):
                continue
            label = _clean(str(row.get("x") or ""))
            try:
                count = int(float(row.get("y") or 0))
            except (TypeError, ValueError):
                continue
            if not label:
                continue
            chart_points.append({"label": label, "count": max(count, 0)})

    reports_24h = sum(point.get("count", 0) for point in chart_points) if chart_points else None

    last_reviewed_match = re.search(r'"lastReviewed":"([^"]+)"', html)
    last_reviewed_at = last_reviewed_match.group(1) if last_reviewed_match else None

    summary, current_status = extract_status_text(page_text)
    return {
        "source": "IsDown",
        "source_type": "Downdetector-like",
        "url": source_url,
        "summary": summary,
        "current_status": current_status,
        "reports_24h": reports_24h,
        "incidents": [],
        "top_reported_issues": [],
        "user_reports_24h": chart_points[:120],
        "user_reports_24h_meta": {
            "source": "IsDown",
            "kind": "user-reports-chart",
            "window_hours": 24,
            "sample_count": len(chart_points),
            "interval_minutes": 20 if chart_points else None,
            "last_reviewed_at": last_reviewed_at,
        },
        "last_reviewed_at": last_reviewed_at,
    }


__all__ = ["parse_isdown_outage_html"]
