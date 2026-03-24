from __future__ import annotations

import datetime as dt
import os
import unittest
from unittest.mock import patch

import scripts.send_brevo_major_alert as send_brevo_major_alert


class SendBrevoMajorAlertTests(unittest.TestCase):
    def test_fetch_subscribers_filters_target_email(self) -> None:
        profile_rows = [
            {
                "user_id": "user-1",
                "email": "first@example.com",
                "connection_status": "active",
                "brevo_sync_status": "synced",
                "provider_contact_id": "1",
            },
            {
                "user_id": "user-2",
                "email": "second@example.com",
                "connection_status": "active",
                "brevo_sync_status": "synced",
                "provider_contact_id": "2",
            },
        ]
        preference_rows = [
            {
                "user_id": "user-1",
                "alerts_enabled": True,
                "severity_threshold": "major",
                "watched_service_ids": ["openai"],
                "favorite_sync_enabled": False,
                "updated_at": None,
            },
            {
                "user_id": "user-2",
                "alerts_enabled": True,
                "severity_threshold": "degraded",
                "watched_service_ids": ["cloudflare"],
                "favorite_sync_enabled": False,
                "updated_at": None,
            },
        ]

        with patch.object(
            send_brevo_major_alert,
            "_fetch_supabase_rows",
            side_effect=[profile_rows, preference_rows],
        ):
            subscribers = send_brevo_major_alert._fetch_subscribers(
                "https://example.supabase.co",
                "service-role",
                "second@example.com",
            )

        self.assertEqual(len(subscribers), 1)
        self.assertEqual(subscribers[0]["user_id"], "user-2")
        self.assertEqual(subscribers[0]["email"], "second@example.com")
        self.assertEqual(subscribers[0]["watched_service_ids"], ["cloudflare"])

    def test_main_prefers_forced_subscriber_test_when_target_secret_exists(self) -> None:
        fake_now = dt.datetime(2026, 3, 24, 1, 45, tzinfo=dt.UTC)
        written_state: dict = {}

        def capture_state(_path, payload):
            written_state.clear()
            written_state.update(payload)

        with (
            patch.dict(
                os.environ,
                {
                    "BREVO_API_KEY": "brevo-key",
                    "ALERT_EMAIL_FROM": "alerts@example.com",
                    "ALERT_FORCE_SEND": "1",
                    "ALERT_TEST_SUBSCRIBER_EMAIL": "user@example.com",
                    "ALERT_SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SERVICE_ROLE_KEY": "service-role",
                    "ALERT_EMAIL_TO": "legacy@example.com",
                },
                clear=False,
            ),
            patch.object(send_brevo_major_alert, "_now", return_value=fake_now),
            patch.object(send_brevo_major_alert, "_read_json", return_value={}),
            patch.object(send_brevo_major_alert, "_write_json", side_effect=capture_state),
            patch.object(send_brevo_major_alert, "_dispatch_to_subscribers", return_value=(1, 1)) as dispatch_mock,
            patch.object(send_brevo_major_alert, "_dispatch_legacy_recipients") as legacy_mock,
            patch("builtins.print"),
        ):
            send_brevo_major_alert.main()

        dispatch_mock.assert_called_once()
        self.assertEqual(dispatch_mock.call_args.args[6], True)
        self.assertEqual(dispatch_mock.call_args.args[10], "user@example.com")
        legacy_mock.assert_not_called()
        self.assertEqual(written_state["last_run"]["mode"], "forced_subscriber_test")
        self.assertEqual(written_state["last_run"]["result"], "sent")


if __name__ == "__main__":
    unittest.main()
