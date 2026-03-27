from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import scripts.build_react_artifacts as build_react_artifacts


class BuildReactArtifactsTests(unittest.TestCase):
    def test_resolve_build_version_uses_github_sha_and_target_slug(self) -> None:
        with mock.patch.dict(os.environ, {"GITHUB_SHA": "1234567890abcdef1234"}, clear=False):
            version = build_react_artifacts.resolve_build_version("preview build")

        self.assertEqual(version, "1234567890ab-preview-build")

    def test_stamp_service_worker_replaces_version_placeholder(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dist_dir = Path(temp_dir)
            (dist_dir / "assets").mkdir()
            service_worker_path = dist_dir / "sw.js"
            service_worker_path.write_text(
                'const VERSION = "__OWSTATUS_SW_VERSION__";\n',
                encoding="utf-8",
            )

            with mock.patch.object(build_react_artifacts, "DIST_DIR", dist_dir):
                build_react_artifacts.stamp_service_worker("abc123-root")

            stamped = service_worker_path.read_text(encoding="utf-8")
            self.assertIn("abc123-root", stamped)
            self.assertNotIn(build_react_artifacts.SERVICE_WORKER_VERSION_TOKEN, stamped)

    def test_stamp_service_worker_requires_placeholder(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dist_dir = Path(temp_dir)
            (dist_dir / "assets").mkdir()
            service_worker_path = dist_dir / "sw.js"
            service_worker_path.write_text('const VERSION = "static";\n', encoding="utf-8")

            with mock.patch.object(build_react_artifacts, "DIST_DIR", dist_dir):
                with self.assertRaises(ValueError):
                    build_react_artifacts.stamp_service_worker("abc123-root")


if __name__ == "__main__":
    unittest.main()
