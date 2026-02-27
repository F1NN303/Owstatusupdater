from __future__ import annotations

import json
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVICE_DATA_DIRS = {
    "overwatch": ROOT / "site" / "data",
    "sony": ROOT / "site" / "sony" / "data",
    "m365": ROOT / "site" / "m365" / "data",
    "openai": ROOT / "site" / "openai" / "data",
    "steam": ROOT / "site" / "steam" / "data",
}
VALID_HEALTH = {"ok", "degraded", "error"}
VALID_SEVERITY = {"stable", "minor", "degraded", "major", "unknown"}


class PayloadContractTests(unittest.TestCase):
    def _load_json(self, path: Path) -> dict:
        self.assertTrue(path.exists(), f"Missing file: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    def test_status_json_contract(self) -> None:
        required_top_keys = {
            "generated_at",
            "health",
            "analytics",
            "regions",
            "official",
            "outage",
            "reports",
            "news",
            "social",
            "known_resources",
            "sources",
        }
        for service, data_dir in SERVICE_DATA_DIRS.items():
            with self.subTest(service=service):
                status = self._load_json(data_dir / "status.json")
                self.assertTrue(required_top_keys.issubset(status.keys()))
                self.assertIsInstance(status["generated_at"], str)
                self.assertIn(str(status["health"]), VALID_HEALTH)

                analytics = status["analytics"]
                self.assertIsInstance(analytics, dict)
                self.assertIn(str(analytics.get("severity_key")), VALID_SEVERITY)
                self.assertIsInstance(analytics.get("severity_score"), int)

                source_ok_count = analytics.get("source_ok_count")
                source_total_count = analytics.get("source_total_count")
                sources = status["sources"]
                self.assertIsInstance(sources, list)
                self.assertGreaterEqual(len(sources), 1)
                if isinstance(source_total_count, int):
                    self.assertEqual(source_total_count, len(sources))
                if isinstance(source_ok_count, int) and isinstance(source_total_count, int):
                    self.assertGreaterEqual(source_ok_count, 0)
                    self.assertLessEqual(source_ok_count, source_total_count)

                for source in sources:
                    self.assertIsInstance(source, dict)
                    self.assertIsInstance(source.get("name"), str)
                    self.assertIn("ok", source)
                    self.assertIsInstance(source.get("url"), str)

                outage = status["outage"]
                self.assertIsInstance(outage, dict)
                self.assertIsInstance(outage.get("summary"), str)
                self.assertIsInstance(outage.get("incidents"), list)

                official = status["official"]
                self.assertIsInstance(official, dict)
                self.assertIn("updates", official)
                self.assertIsInstance(official.get("updates"), list)

    def test_companion_artifacts_contract(self) -> None:
        for service, data_dir in SERVICE_DATA_DIRS.items():
            with self.subTest(service=service):
                history = self._load_json(data_dir / "history.json")
                self.assertIsInstance(history.get("points"), list)
                self.assertIsInstance(history.get("cadence_minutes"), int)
                self.assertGreater(history.get("cadence_minutes"), 0)
                self.assertIsInstance(history.get("retention_days"), int)

                summary = self._load_json(data_dir / "summary.json")
                self.assertIn(str(summary.get("health")), VALID_HEALTH)
                self.assertIn(str(summary.get("severity_key")), VALID_SEVERITY)
                source_agreement = summary.get("source_agreement")
                self.assertIsInstance(source_agreement, dict)
                self.assertIsInstance(source_agreement.get("ok"), int)
                self.assertIsInstance(source_agreement.get("total"), int)

                alerts = self._load_json(data_dir / "alerts.json")
                self.assertIsInstance(alerts.get("events"), list)
                self.assertIsInstance(alerts.get("unread_count"), int)

                rss_path = data_dir / "rss.xml"
                self.assertTrue(rss_path.exists(), f"Missing file: {rss_path}")
                rss_root = ET.fromstring(rss_path.read_text(encoding="utf-8"))
                self.assertEqual(rss_root.tag, "rss")


if __name__ == "__main__":
    unittest.main()
