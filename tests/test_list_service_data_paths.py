from __future__ import annotations

import unittest
from pathlib import Path

from scripts.list_service_data_paths import list_service_data_paths


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config" / "services"


class ListServiceDataPathsTests(unittest.TestCase):
    def test_lists_expected_paths_for_enabled_services(self) -> None:
        paths = list_service_data_paths(CONFIG_DIR)
        self.assertGreaterEqual(len(paths), 1)
        self.assertEqual(paths, sorted(set(paths)))

        expected = {
            "site/data",
            "site/sony/data",
            "site/m365/data",
            "site/openai/data",
            "site/data/services-manifest.json",
        }
        self.assertTrue(expected.issubset(set(paths)))

        for path in paths:
            self.assertTrue(path.startswith("site/"))


if __name__ == "__main__":
    unittest.main()
