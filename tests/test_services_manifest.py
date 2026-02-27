from __future__ import annotations

import json
import unittest
from pathlib import Path

import scripts.build_site_data as build_site_data


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "site" / "data" / "services-manifest.json"


class ServicesManifestContractTests(unittest.TestCase):
    def test_manifest_payload_contract(self) -> None:
        payload = build_site_data._build_services_manifest_payload()
        self.assertEqual(payload.get("schema_version"), 1)

        services = payload.get("services")
        self.assertIsInstance(services, list)
        self.assertGreaterEqual(len(services), 1)

        ids: list[str] = []
        for entry in services:
            self.assertIsInstance(entry, dict)
            service_id = str(entry.get("id") or "").strip().lower()
            self.assertTrue(service_id)
            ids.append(service_id)

            self.assertIsInstance(entry.get("label"), str)
            self.assertIsInstance(entry.get("name"), str)
            self.assertIsInstance(entry.get("detail_path"), str)
            self.assertIsInstance(entry.get("status_path"), str)
            self.assertTrue(str(entry.get("detail_path")).startswith("/"))
            self.assertTrue(str(entry.get("status_path")).startswith("/"))
            self.assertIsInstance(entry.get("category"), str)
            self.assertTrue(str(entry.get("category")).strip())
            self.assertIsInstance(entry.get("priority"), int)
            self.assertGreaterEqual(int(entry.get("priority")), 0)

            tags = entry.get("tags")
            self.assertIsInstance(tags, list)
            tag_values = [str(tag).strip().lower() for tag in tags]
            self.assertEqual(len(tag_values), len(set(tag_values)))

            aliases = entry.get("aliases")
            self.assertIsInstance(aliases, list)
            alias_values = [str(alias).strip().lower() for alias in aliases]
            self.assertIn(service_id, alias_values)
            self.assertEqual(len(alias_values), len(set(alias_values)))

        self.assertEqual(len(ids), len(set(ids)))

        # Keep deterministic home card ordering for core services.
        core_ids = ["overwatch", "sony", "m365", "openai"]
        for core_id in core_ids:
            self.assertIn(core_id, ids)
        self.assertLess(ids.index("overwatch"), ids.index("sony"))
        self.assertLess(ids.index("sony"), ids.index("m365"))
        self.assertLess(ids.index("m365"), ids.index("openai"))

    def test_published_manifest_matches_builder_payload_ids(self) -> None:
        self.assertTrue(MANIFEST_PATH.exists(), f"Missing file: {MANIFEST_PATH}")

        published = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        built = build_site_data._build_services_manifest_payload()
        published_ids = [str(item.get("id") or "").strip().lower() for item in published.get("services", [])]
        built_ids = [str(item.get("id") or "").strip().lower() for item in built.get("services", [])]
        self.assertEqual(published_ids, built_ids)


if __name__ == "__main__":
    unittest.main()
