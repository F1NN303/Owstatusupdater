from __future__ import annotations

import unittest
from unittest.mock import patch

import scripts.build_site_data as build_site_data
import services.openai_aggregator as openai_aggregator
import services.steam_aggregator as steam_aggregator
from services.core.source_runner import CallableSourceAdapter, SourceAdapterSpec, SourceRunResult, run_source_adapter


VALID_SEVERITY = {"stable", "minor", "degraded", "major", "unknown"}


def _source_entry(name: str, ok: bool) -> dict[str, object]:
    return {
        "name": name,
        "kind": "test",
        "url": "https://example.test",
        "ok": ok,
        "error": None if ok else "simulated failure",
        "item_count": 1 if ok else 0,
        "last_item_at": "2026-02-27T00:00:00Z" if ok else None,
        "freshness": "fresh" if ok else "unknown",
        "age_minutes": 0 if ok else None,
        "duration_ms": 1,
        "fetched_at": "2026-02-27T00:00:01Z",
    }


class SourceRunnerResilienceTests(unittest.TestCase):
    def test_run_source_adapter_failure_returns_structured_result(self) -> None:
        def _fetch_failure():
            raise RuntimeError("boom")

        adapter = CallableSourceAdapter(
            spec=SourceAdapterSpec(
                service_id="test",
                adapter_id="failing-source",
                name="Failing Source",
                kind="test",
                url="https://example.test",
                cache_ttl_seconds=0,
            ),
            fetch_fn=_fetch_failure,
            item_count_fn=lambda _: 0,
            last_item_at_fn=lambda _: None,
        )

        result = run_source_adapter(
            adapter,
            utc_now_iso=lambda: "2026-02-27T00:00:00Z",
            source_freshness=lambda _: ("unknown", None),
            safe_error_message=lambda exc: str(exc),
        )

        self.assertFalse(result.ok)
        self.assertIsNone(result.data)
        self.assertFalse(result.source.get("ok"))
        self.assertEqual(result.source.get("name"), "Failing Source")
        self.assertIn("boom", str(result.source.get("error")))


class BuilderInvocationTests(unittest.TestCase):
    def test_invoke_builder_filters_unsupported_kwargs(self) -> None:
        called: dict[str, object] = {}

        def _builder(*, force_refresh: bool) -> dict:
            called["force_refresh"] = force_refresh
            called["args_count"] = 1
            return {"generated_at": "2026-02-27T00:00:00Z"}

        payload = build_site_data._invoke_builder(
            _builder,
            {
                "force_refresh": True,
                "scoring_profile": "official_first_v1",
                "unexpected": "value",
            },
        )
        self.assertEqual(payload.get("generated_at"), "2026-02-27T00:00:00Z")
        self.assertEqual(called.get("force_refresh"), True)
        self.assertEqual(called.get("args_count"), 1)


class OpenAIAggregatorResilienceTests(unittest.TestCase):
    def test_collect_payload_with_partial_source_failures(self) -> None:
        statusgator_data = {
            "source": "StatusGator",
            "source_type": "Downdetector-like",
            "url": "https://statusgator.com/services/openai",
            "summary": "StatusGator indicates OpenAI / ChatGPT is currently degraded.",
            "current_status": "degraded",
            "reports_24h": 150,
            "incidents": [
                {
                    "title": "Test incident",
                    "started_at": "2026-02-27T00:00:00Z",
                    "duration": "45m",
                    "acknowledgement": "simulated",
                }
            ],
            "top_reported_issues": [{"label": "Error message", "count": 10}],
        }

        def _run_side_effect(**kwargs):
            adapter_id = kwargs.get("adapter_id")
            if adapter_id == "statusgator":
                return SourceRunResult(
                    ok=True,
                    data=statusgator_data,
                    source=_source_entry("StatusGator", True),
                )
            if adapter_id == "isdown_chatgpt":
                return SourceRunResult(
                    ok=False,
                    data=None,
                    source=_source_entry("IsDown (ChatGPT)", False),
                    error="simulated failure",
                )
            if adapter_id == "openai_statuspage_api":
                return SourceRunResult(
                    ok=False,
                    data=None,
                    source=_source_entry("OpenAI Statuspage API", False),
                    error="simulated failure",
                )
            raise AssertionError(f"Unexpected adapter_id: {adapter_id}")

        with patch("services.openai_aggregator._run_openai_source", side_effect=_run_side_effect):
            payload = openai_aggregator._collect_payload(scoring_profile="official_first_v1")

        self.assertEqual(payload.get("health"), "degraded")
        self.assertEqual(len(payload.get("sources") or []), 3)
        self.assertEqual(payload.get("analytics", {}).get("source_ok_count"), 1)
        self.assertEqual(payload.get("analytics", {}).get("source_total_count"), 3)
        self.assertIn(payload.get("analytics", {}).get("severity_key"), VALID_SEVERITY)
        self.assertIsInstance(payload.get("outage", {}).get("summary"), str)
        self.assertIsInstance(payload.get("outage", {}).get("incidents"), list)
        self.assertIsInstance(payload.get("official", {}).get("summary"), str)

    def test_collect_payload_when_all_sources_fail_returns_error_health(self) -> None:
        def _run_side_effect(**kwargs):
            name = str(kwargs.get("name") or kwargs.get("adapter_id") or "source")
            return SourceRunResult(
                ok=False,
                data=None,
                source=_source_entry(name, False),
                error="simulated failure",
            )

        with patch("services.openai_aggregator._run_openai_source", side_effect=_run_side_effect):
            payload = openai_aggregator._collect_payload(scoring_profile="official_first_v1")

        self.assertEqual(payload.get("health"), "error")
        self.assertEqual(payload.get("analytics", {}).get("source_ok_count"), 0)
        self.assertEqual(payload.get("analytics", {}).get("source_total_count"), 3)
        self.assertIn(payload.get("analytics", {}).get("severity_key"), VALID_SEVERITY)
        self.assertIsInstance(payload.get("outage", {}).get("summary"), str)
        self.assertIsInstance(payload.get("sources"), list)


class SteamAggregatorResilienceTests(unittest.TestCase):
    def test_collect_payload_with_partial_source_failures(self) -> None:
        server_info_data = {
            "checked_at": "2026-02-27T00:00:00Z",
            "servertime": 1772150400,
            "servertimestring": "Fri Feb 27 00:00:00 2026",
        }
        cm_connect_data = {
            "checked_at": "2026-02-27T00:00:00Z",
            "sample_count": 50,
            "load_sample_count": 50,
            "avg_load": 38.2,
            "max_load": 71.5,
            "high_load_count": 0,
            "critical_load_count": 0,
            "top_datacenters": [{"dc": "iad", "count": 8}],
        }
        cm_list_data = {
            "checked_at": "2026-02-27T00:00:00Z",
            "tcp_count": 50,
            "websocket_count": 50,
            "total_endpoints": 100,
        }
        store_probe_data = {
            "checked_at": "2026-02-27T00:00:00Z",
            "name": "Steam Store",
            "url": "https://store.steampowered.com/",
            "status_code": 200,
            "latency_ms": 620,
            "content_length": 1000,
        }
        community_probe_data = {
            "checked_at": "2026-02-27T00:00:00Z",
            "name": "Steam Community",
            "url": "https://steamcommunity.com/",
            "status_code": 200,
            "latency_ms": 540,
            "content_length": 1000,
        }

        def _run_side_effect(**kwargs):
            adapter_id = kwargs.get("adapter_id")
            if adapter_id == "steam_server_info_api":
                return SourceRunResult(
                    ok=True,
                    data=server_info_data,
                    source=_source_entry("Steam Web API (GetServerInfo)", True),
                )
            if adapter_id == "steam_cm_list_connect_api":
                return SourceRunResult(
                    ok=True,
                    data=cm_connect_data,
                    source=_source_entry("Steam Directory API (GetCMListForConnect)", True),
                )
            if adapter_id == "steam_cm_list_api":
                return SourceRunResult(
                    ok=True,
                    data=cm_list_data,
                    source=_source_entry("Steam Directory API (GetCMList)", True),
                )
            if adapter_id == "steam_store_probe":
                return SourceRunResult(
                    ok=True,
                    data=store_probe_data,
                    source=_source_entry("Steam Store", True),
                )
            if adapter_id == "steam_community_probe":
                return SourceRunResult(
                    ok=True,
                    data=community_probe_data,
                    source=_source_entry("Steam Community", True),
                )
            if adapter_id == "isdown_steam":
                return SourceRunResult(
                    ok=False,
                    data=None,
                    source=_source_entry("IsDown (Steam)", False),
                    error="simulated failure",
                )
            raise AssertionError(f"Unexpected adapter_id: {adapter_id}")

        with patch("services.steam_aggregator._run_steam_source", side_effect=_run_side_effect):
            payload = steam_aggregator._collect_payload(scoring_profile="baseline_v1")

        self.assertEqual(payload.get("health"), "degraded")
        self.assertEqual(len(payload.get("sources") or []), 6)
        self.assertEqual(payload.get("analytics", {}).get("source_ok_count"), 5)
        self.assertEqual(payload.get("analytics", {}).get("source_total_count"), 6)
        self.assertIn(payload.get("analytics", {}).get("severity_key"), VALID_SEVERITY)
        self.assertIsInstance(payload.get("outage", {}).get("summary"), str)
        self.assertIsInstance(payload.get("outage", {}).get("components"), list)
        self.assertIsInstance(payload.get("official", {}).get("summary"), str)

    def test_collect_payload_when_all_sources_fail_returns_error_health(self) -> None:
        def _run_side_effect(**kwargs):
            name = str(kwargs.get("name") or kwargs.get("adapter_id") or "source")
            return SourceRunResult(
                ok=False,
                data=None,
                source=_source_entry(name, False),
                error="simulated failure",
            )

        with patch("services.steam_aggregator._run_steam_source", side_effect=_run_side_effect):
            payload = steam_aggregator._collect_payload(scoring_profile="baseline_v1")

        self.assertEqual(payload.get("health"), "error")
        self.assertEqual(payload.get("analytics", {}).get("source_ok_count"), 0)
        self.assertEqual(payload.get("analytics", {}).get("source_total_count"), 6)
        self.assertIn(payload.get("analytics", {}).get("severity_key"), VALID_SEVERITY)
        self.assertIsInstance(payload.get("outage", {}).get("summary"), str)
        self.assertIsInstance(payload.get("sources"), list)


if __name__ == "__main__":
    unittest.main()
