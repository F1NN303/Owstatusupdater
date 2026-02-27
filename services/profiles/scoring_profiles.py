from __future__ import annotations

from typing import Any


def apply_scoring_profile(
    profile_id: str | None,
    *,
    score: float,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    key = str(profile_id or "").strip().lower()
    base_score = float(score)
    ctx = context or {}

    if key in {"", "default", "core_default_v1", "baseline_v1"}:
        return {
            "score": base_score,
            "score_adjustment": 0.0,
            "safeguards": {},
        }

    if key == "official_first_v1":
        stable_max = float(ctx.get("stable_max", 2.4))
        minor_max = float(ctx.get("minor_max", 4.8))
        degraded_max = float(ctx.get("degraded_max", 8.0))

        official_status_key = str(ctx.get("official_status_key") or "").strip().lower()
        official_active_incident_count = int(ctx.get("official_active_incident_count") or 0)
        official_source_freshness = str(ctx.get("official_source_freshness") or "").strip().lower()

        reports_24h = int(ctx.get("reports_24h") or 0)
        recent_incidents_6h = int(ctx.get("recent_incidents_6h") or 0)
        support_score = float(ctx.get("support_score") or 0.0)

        source_is_recent = official_source_freshness in {"fresh", "warm"}
        adjusted = base_score

        safeguards = {
            "official_operational_cap_applied": False,
            "official_active_incident_floor_applied": False,
        }

        if official_status_key == "operational" and official_active_incident_count == 0 and source_is_recent:
            if reports_24h < 2200 and recent_incidents_6h == 0 and support_score < 2.2:
                adjusted = min(adjusted, stable_max - 0.05)
            else:
                adjusted = min(adjusted, minor_max - 0.05)
            safeguards["official_operational_cap_applied"] = True

        if source_is_recent and official_active_incident_count > 0:
            if official_status_key == "major outage":
                floor_score = degraded_max + 0.05
            else:
                floor_score = minor_max + 0.05
            if adjusted < floor_score:
                adjusted = floor_score
                safeguards["official_active_incident_floor_applied"] = True

        adjusted = max(adjusted, 0.0)
        return {
            "score": adjusted,
            "score_adjustment": round(adjusted - base_score, 3),
            "safeguards": safeguards,
        }

    return {
        "score": base_score,
        "score_adjustment": 0.0,
        "safeguards": {"profile_unrecognized": True},
    }


__all__ = ["apply_scoring_profile"]

