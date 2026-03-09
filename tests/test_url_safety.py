from __future__ import annotations

import datetime as dt
import unittest
from unittest.mock import patch

import services.ow_aggregator as ow_aggregator
from scripts.send_brevo_major_alert import _build_email_payload, _parse_cooldown_minutes, _should_send_major_alert
from services.core.shared import _safe_http_url


class UrlSafetyTests(unittest.TestCase):
    def test_safe_http_url_rejects_unsafe_schemes(self) -> None:
        self.assertIsNone(_safe_http_url("javascript:alert(1)"))
        self.assertIsNone(_safe_http_url("data:text/html,<script>alert(1)</script>"))
        self.assertEqual(_safe_http_url("https://example.com/path?q=1"), "https://example.com/path?q=1")

    def test_build_email_payload_escapes_html_summary_and_invalid_source_url(self) -> None:
        payload = _build_email_payload(
            {
                "generated_at": "2026-03-08T00:00:00Z",
                "analytics": {
                    "severity_key": "major",
                    "source_ok_count": 1,
                    "source_total_count": 2,
                },
                "outage": {
                    "reports_24h": 42,
                    "summary": '<img src=x onerror=alert(1)>',
                    "url": "javascript:alert(1)",
                },
            },
            "https://status.example.com/",
            "Radar Sender",
            "sender@example.com",
            ["recipient@example.com"],
            False,
        )

        html = payload["htmlContent"]
        self.assertIn("&lt;img src=x onerror=alert(1)&gt;", html)
        self.assertNotIn('<img src=x onerror=alert(1)>', html)
        self.assertNotIn("javascript:alert(1)", html)
        self.assertIn('href="https://status.example.com/"', html)

    @patch.object(ow_aggregator, "_request_text")
    def test_fetch_overwatch_news_skips_non_http_urls(self, mock_request_text) -> None:
        mock_request_text.return_value = """
        <div>
          <a slot="gallery-items" href="javascript:alert(1)">
            <h3 slot="heading">Unsafe item</h3>
            <blz-timestamp timestamp="2026-03-08T10:00:00Z"></blz-timestamp>
          </a>
          <a slot="gallery-items" href="/en-us/news/update">
            <h3 slot="heading">Safe item</h3>
            <blz-timestamp timestamp="2026-03-08T11:00:00Z"></blz-timestamp>
          </a>
        </div>
        """

        items = ow_aggregator.fetch_overwatch_news(limit=8)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "Safe item")
        self.assertTrue(items[0]["url"].startswith("https://"))

    def test_major_alert_repeat_with_new_snapshot_stays_blocked_during_cooldown(self) -> None:
        now = dt.datetime(2026, 3, 9, 18, 0, tzinfo=dt.UTC)
        should_send, reason = _should_send_major_alert(
            {
                "generated_at": "2026-03-09T18:00:00Z",
                "analytics": {"severity_key": "major"},
            },
            {
                "last_seen_severity": "major",
                "last_major_email_at": "2026-03-09T17:59:55Z",
                "last_major_status_generated_at": "2026-03-09T17:55:00Z",
            },
            now,
            cooldown_minutes=360,
            force_send=False,
        )

        self.assertFalse(should_send)
        self.assertEqual(reason, "cooldown_active")

    def test_major_alert_duplicate_snapshot_is_skipped(self) -> None:
        now = dt.datetime(2026, 3, 9, 18, 0, tzinfo=dt.UTC)
        should_send, reason = _should_send_major_alert(
            {
                "generated_at": "2026-03-09T18:00:00Z",
                "analytics": {"severity_key": "major"},
            },
            {
                "last_seen_severity": "major",
                "last_major_email_at": "2026-03-09T10:00:00Z",
                "last_major_status_generated_at": "2026-03-09T18:00:00Z",
            },
            now,
            cooldown_minutes=360,
            force_send=False,
        )

        self.assertFalse(should_send)
        self.assertEqual(reason, "duplicate_snapshot")

    def test_major_alert_force_send_bypasses_cooldown(self) -> None:
        now = dt.datetime(2026, 3, 9, 18, 0, tzinfo=dt.UTC)
        should_send, reason = _should_send_major_alert(
            {
                "generated_at": "2026-03-09T18:00:00Z",
                "analytics": {"severity_key": "stable"},
            },
            {
                "last_seen_severity": "major",
                "last_major_email_at": "2026-03-09T17:59:55Z",
                "last_major_status_generated_at": "2026-03-09T17:55:00Z",
            },
            now,
            cooldown_minutes=360,
            force_send=True,
        )

        self.assertTrue(should_send)
        self.assertEqual(reason, "force_send")

    def test_parse_cooldown_minutes_falls_back_for_invalid_values(self) -> None:
        self.assertEqual(_parse_cooldown_minutes(""), 360)
        self.assertEqual(_parse_cooldown_minutes("bad"), 360)
        self.assertEqual(_parse_cooldown_minutes("0"), 1)


if __name__ == "__main__":
    unittest.main()
