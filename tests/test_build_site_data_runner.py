from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

import scripts.build_site_data as build_site_data


class BuildSiteDataRunnerTests(unittest.TestCase):
    def test_resolve_builder_import_target(self) -> None:
        builder = build_site_data._resolve_builder("json:dumps")
        self.assertTrue(callable(builder))

    def test_resolve_builder_rejects_invalid_target(self) -> None:
        with self.assertRaises(ValueError):
            build_site_data._resolve_builder("invalid-target")

    def test_main_all_returns_error_when_one_service_fails(self) -> None:
        def _build_side_effect(service_key: str, manifest_path: Path) -> None:
            if service_key == "beta":
                raise RuntimeError("simulated failure")

        with (
            patch.object(build_site_data, "_service_keys_for_build", return_value=["alpha", "beta"]),
            patch.object(build_site_data, "_write_services_manifest", return_value=Path("site/data/services-manifest.json")),
            patch.object(build_site_data, "_build_single_service", side_effect=_build_side_effect),
            patch("builtins.print"),
        ):
            exit_code = build_site_data.main("all", allow_partial_success=False)

        self.assertEqual(exit_code, 1)

    def test_main_all_allow_partial_success_returns_zero(self) -> None:
        def _build_side_effect(service_key: str, manifest_path: Path) -> None:
            if service_key == "beta":
                raise RuntimeError("simulated failure")

        with (
            patch.object(build_site_data, "_service_keys_for_build", return_value=["alpha", "beta"]),
            patch.object(build_site_data, "_write_services_manifest", return_value=Path("site/data/services-manifest.json")),
            patch.object(build_site_data, "_build_single_service", side_effect=_build_side_effect),
            patch("builtins.print"),
        ):
            exit_code = build_site_data.main("all", allow_partial_success=True)

        self.assertEqual(exit_code, 0)


if __name__ == "__main__":
    unittest.main()
