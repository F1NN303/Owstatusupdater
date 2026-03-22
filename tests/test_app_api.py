from __future__ import annotations

import unittest
from unittest.mock import patch

import app as status_app


class ApiStatusResponseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = status_app.app.test_client()

    def test_status_endpoint_sets_public_cache_headers(self) -> None:
        with patch("app.build_dashboard_payload", return_value={"health": "ok"}):
            response = self.client.get("/api/status")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Cache-Control"), "public, max-age=60, stale-while-revalidate=60")

    def test_status_endpoint_disables_caching_for_force_refresh(self) -> None:
        with patch("app.build_dashboard_payload", return_value={"health": "ok"}):
            response = self.client.get("/api/status?refresh=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")

    def test_status_endpoint_uses_503_for_error_health(self) -> None:
        with patch("app.build_dashboard_payload", return_value={"health": "error"}):
            response = self.client.get("/api/status")

        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
