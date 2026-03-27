from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
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

    def test_write_legacy_data_mirrors_copies_overwatch_public_artifacts(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            canonical_dir = root / "site" / "overwatch" / "data"
            mirror_dir = root / "site" / "data"
            canonical_dir.mkdir(parents=True, exist_ok=True)
            for filename in build_site_data.GENERATED_DATA_FILENAMES:
                (canonical_dir / filename).write_text(f"{filename}-content", encoding="utf-8")

            with patch.object(
                build_site_data,
                "LEGACY_SERVICE_DATA_MIRROR_DIRS",
                {"overwatch": (mirror_dir,)},
            ):
                mirrored = build_site_data._write_legacy_data_mirrors("overwatch", canonical_dir)

            self.assertEqual(
                sorted(path.name for path in mirrored),
                sorted(build_site_data.GENERATED_DATA_FILENAMES),
            )
            for filename in build_site_data.GENERATED_DATA_FILENAMES:
                self.assertEqual(
                    (mirror_dir / filename).read_text(encoding="utf-8"),
                    f"{filename}-content",
                )

    def test_read_history_with_legacy_fallback_uses_root_mirror_when_canonical_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            canonical_history = root / "site" / "overwatch" / "data" / "history.json"
            legacy_history = root / "site" / "data" / "history.json"
            legacy_history.parent.mkdir(parents=True, exist_ok=True)
            legacy_history.write_text(
                '{"updated_at":"2026-03-27T20:00:00Z","cadence_minutes":30,"retention_days":30,"points":[{"t":"2026-03-27T20:00:00Z"}]}',
                encoding="utf-8",
            )

            with patch.object(
                build_site_data,
                "LEGACY_SERVICE_DATA_MIRROR_DIRS",
                {"overwatch": (legacy_history.parent,)},
            ):
                history = build_site_data._read_history_with_legacy_fallback(
                    "overwatch",
                    canonical_history,
                )

            self.assertEqual(len(history["points"]), 1)
            self.assertEqual(history["points"][0]["t"], "2026-03-27T20:00:00Z")


if __name__ == "__main__":
    unittest.main()
