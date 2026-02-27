from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.validate_services import validate_service_configs


def _service_yaml(
    *,
    service_id: str,
    label: str,
    builder: str,
    site_url: str,
    data_dir: str,
    state_path: str,
    scoring_profile: str,
    home_order: str,
    priority: str,
    category: str,
    aliases: str,
    tags: str,
    icon: str = "Globe",
) -> str:
    return "\n".join(
        [
            f"id: {service_id}",
            f"label: {label}",
            f"display_name: {label}",
            f"builder: {builder}",
            f"site_url: {site_url}",
            f"data_dir: {data_dir}",
            f"state_path: {state_path}",
            f"scoring_profile: {scoring_profile}",
            f"home_order: {home_order}",
            f"priority: {priority}",
            f"category: {category}",
            "legacy_href: /service/",
            f"icon: {icon}",
            f"aliases: {aliases}",
            f"tags: {tags}",
            "note: test",
            "enabled: true",
            "home_enabled: true",
        ]
    )


class ValidateServicesTests(unittest.TestCase):
    def _write(self, config_dir: Path, filename: str, content: str) -> None:
        (config_dir / filename).write_text(content + "\n", encoding="utf-8")

    def test_valid_service_configs_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_dir = Path(temp_dir)
            self._write(
                config_dir,
                "alpha.yaml",
                _service_yaml(
                    service_id="alpha",
                    label="Alpha",
                    builder="alpha",
                    site_url="https://example.test/alpha/",
                    data_dir="site/alpha/data",
                    state_path=".bot_state/alpha_state.json",
                    scoring_profile="baseline_v1",
                    home_order="10",
                    priority="100",
                    category="gaming",
                    aliases="alpha,a",
                    tags="alpha,core",
                ),
            )
            self._write(
                config_dir,
                "beta.yaml",
                _service_yaml(
                    service_id="beta",
                    label="Beta",
                    builder="beta",
                    site_url="https://example.test/beta/",
                    data_dir="site/beta/data",
                    state_path=".bot_state/beta_state.json",
                    scoring_profile="official_first_v1",
                    home_order="20",
                    priority="200",
                    category="productivity",
                    aliases="beta,b",
                    tags="beta,collab",
                    icon="Cpu",
                ),
            )

            errors = validate_service_configs(config_dir)
            self.assertEqual(errors, [])

    def test_duplicate_alias_across_services_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_dir = Path(temp_dir)
            self._write(
                config_dir,
                "first.yaml",
                _service_yaml(
                    service_id="first",
                    label="First",
                    builder="first",
                    site_url="https://example.test/first/",
                    data_dir="site/first/data",
                    state_path=".bot_state/first_state.json",
                    scoring_profile="baseline_v1",
                    home_order="10",
                    priority="100",
                    category="gaming",
                    aliases="first,shared",
                    tags="first,live",
                ),
            )
            self._write(
                config_dir,
                "second.yaml",
                _service_yaml(
                    service_id="second",
                    label="Second",
                    builder="second",
                    site_url="https://example.test/second/",
                    data_dir="site/second/data",
                    state_path=".bot_state/second_state.json",
                    scoring_profile="baseline_v1",
                    home_order="20",
                    priority="120",
                    category="gaming",
                    aliases="second,shared",
                    tags="second,live",
                ),
            )

            errors = validate_service_configs(config_dir)
            self.assertTrue(any("alias 'shared' already used" in error for error in errors))

    def test_invalid_paths_icon_and_home_order_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config_dir = Path(temp_dir)
            self._write(
                config_dir,
                "broken.yaml",
                _service_yaml(
                    service_id="broken",
                    label="Broken",
                    builder="broken",
                    site_url="not-a-url",
                    data_dir="bad/data",
                    state_path="state.json",
                    scoring_profile="INVALID",
                    home_order="-1",
                    priority="-5",
                    category="BAD CATEGORY",
                    aliases="broken,bad alias",
                    tags="ok,bad tag,bad tag",
                    icon="Rocket",
                ),
            )

            errors = validate_service_configs(config_dir)
            self.assertTrue(any("invalid site_url" in error for error in errors))
            self.assertTrue(any("data_dir must be under site/" in error for error in errors))
            self.assertTrue(any("state_path must be under .bot_state/" in error for error in errors))
            self.assertTrue(any("unsupported icon 'Rocket'" in error for error in errors))
            self.assertTrue(any("home_order must be a non-negative integer" in error for error in errors))
            self.assertTrue(any("priority must be a non-negative integer" in error for error in errors))
            self.assertTrue(any("invalid category" in error for error in errors))
            self.assertTrue(any("invalid alias 'bad alias'" in error for error in errors))
            self.assertTrue(any("invalid tag 'bad tag'" in error for error in errors))
            self.assertTrue(any("invalid scoring_profile" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
