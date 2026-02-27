from __future__ import annotations

import argparse
import importlib
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

SERVICE_CONFIG_DIR = ROOT / "config" / "services"
SERVICE_CONFIG_GLOBS = ("*.yaml", "*.yml")

ALLOWED_KEYS = {
    "id",
    "label",
    "display_name",
    "builder",
    "site_url",
    "data_dir",
    "state_path",
    "scoring_profile",
    "home_order",
    "priority",
    "category",
    "legacy_href",
    "detail_path",
    "status_path",
    "icon",
    "aliases",
    "tags",
    "note",
    "enabled",
    "home_enabled",
}
REQUIRED_KEYS = {"id", "label", "builder", "site_url", "data_dir", "state_path", "scoring_profile"}
ALLOWED_ICON_NAMES = {"Gamepad2", "Tv", "Flame", "Cpu", "Joystick", "Globe"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
ALIAS_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
CATEGORY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
TAG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate config/services/*.yaml contracts.")
    parser.add_argument(
        "--config-dir",
        default=str(SERVICE_CONFIG_DIR),
        help=f"Service config directory (default: {SERVICE_CONFIG_DIR}).",
    )
    return parser.parse_args()


def _parse_flat_yaml(path: Path) -> dict[str, object]:
    parsed: dict[str, object] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"invalid line '{raw_line.strip()}'")
        key, value_raw = line.split(":", 1)
        key = key.strip()
        value_text = value_raw.strip()
        if not key:
            raise ValueError(f"missing key in line '{raw_line.strip()}'")
        if value_text.lower() in {"true", "false"}:
            parsed[key] = value_text.lower() == "true"
            continue
        if (value_text.startswith('"') and value_text.endswith('"')) or (
            value_text.startswith("'") and value_text.endswith("'")
        ):
            parsed[key] = value_text[1:-1]
            continue
        parsed[key] = value_text
    return parsed


def _parse_bool(value: object, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    lowered = str(value).strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"invalid boolean value '{value}'")


def _parse_int(value: object) -> int:
    return int(str(value).strip())


def _parse_csv(value: object) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    return [item.strip() for item in text.split(",") if item.strip()]


def _validate_builder_target(value: str) -> tuple[bool, str]:
    target = str(value or "").strip()
    if ":" not in target:
        return False, "expected format 'module.path:function_name'"

    module_name, attr_name = target.split(":", 1)
    module_name = module_name.strip()
    attr_name = attr_name.strip()
    if not module_name or not attr_name:
        return False, "expected format 'module.path:function_name'"

    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        return False, f"module import failed ({exc})"

    builder = getattr(module, attr_name, None)
    if not callable(builder):
        return False, f"attribute '{attr_name}' is not callable"
    return True, ""


def _validate_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _validate_relative_path(value: str) -> bool:
    if not value:
        return False
    if value.startswith("/") or value.startswith("\\"):
        return False
    normalized = value.replace("\\", "/")
    if ".." in normalized.split("/"):
        return False
    return True


def _validate_public_path(value: str) -> bool:
    text = str(value or "").strip()
    return bool(text) and text.startswith("/")


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def validate_service_configs(config_dir: Path) -> list[str]:
    errors: list[str] = []
    files: list[Path] = []
    for pattern in SERVICE_CONFIG_GLOBS:
        files.extend(sorted(config_dir.glob(pattern)))
    files = sorted({file.resolve() for file in files})

    if not files:
        return [f"No service config files found in {config_dir}."]

    seen_ids: dict[str, Path] = {}
    alias_to_owner: dict[str, str] = {}
    home_orders: dict[int, str] = {}
    enabled_count = 0

    for path in files:
        rel = _display_path(path)
        try:
            raw = _parse_flat_yaml(path)
        except Exception as exc:
            errors.append(f"{rel}: parse error ({exc})")
            continue

        unknown_keys = sorted(set(raw.keys()) - ALLOWED_KEYS)
        if unknown_keys:
            errors.append(f"{rel}: unknown keys: {', '.join(unknown_keys)}")

        for key in sorted(REQUIRED_KEYS):
            if not str(raw.get(key) or "").strip():
                errors.append(f"{rel}: missing required key '{key}'")

        service_id = str(raw.get("id") or path.stem).strip().lower()
        if not ID_PATTERN.match(service_id):
            errors.append(
                f"{rel}: invalid service id '{service_id}' "
                "(expected lowercase slug 1-64 chars: a-z, 0-9, -, _)"
            )
        else:
            previous_path = seen_ids.get(service_id)
            if previous_path and previous_path != path:
                prev_rel = _display_path(previous_path)
                errors.append(f"{rel}: duplicate service id '{service_id}' already used in {prev_rel}")
            else:
                seen_ids[service_id] = path

        try:
            enabled = _parse_bool(raw.get("enabled"), default=True)
            home_enabled = _parse_bool(raw.get("home_enabled"), default=True)
        except ValueError as exc:
            errors.append(f"{rel}: {exc}")
            continue

        if not enabled:
            continue
        enabled_count += 1

        builder_key = str(raw.get("builder") or "").strip()
        if not builder_key:
            errors.append(f"{rel}: builder must not be empty")
        else:
            is_valid_builder, builder_reason = _validate_builder_target(builder_key)
            if not is_valid_builder:
                errors.append(f"{rel}: invalid builder '{builder_key}' ({builder_reason})")

        site_url = str(raw.get("site_url") or "").strip()
        if not _validate_url(site_url):
            errors.append(f"{rel}: invalid site_url '{site_url}'")

        data_dir = str(raw.get("data_dir") or "").strip()
        if not _validate_relative_path(data_dir):
            errors.append(f"{rel}: invalid data_dir '{data_dir}'")
        else:
            normalized_data_dir = data_dir.replace("\\", "/")
            if not normalized_data_dir.startswith("site/"):
                errors.append(f"{rel}: data_dir must be under site/: '{data_dir}'")
            if not normalized_data_dir.endswith("/data"):
                errors.append(f"{rel}: data_dir should end with '/data': '{data_dir}'")

        state_path = str(raw.get("state_path") or "").strip()
        if not _validate_relative_path(state_path):
            errors.append(f"{rel}: invalid state_path '{state_path}'")
        else:
            normalized_state_path = state_path.replace("\\", "/")
            if not normalized_state_path.startswith(".bot_state/"):
                errors.append(f"{rel}: state_path must be under .bot_state/: '{state_path}'")
            if not normalized_state_path.endswith(".json"):
                errors.append(f"{rel}: state_path should be a .json file: '{state_path}'")

        scoring_profile = str(raw.get("scoring_profile") or "").strip()
        if not scoring_profile:
            errors.append(f"{rel}: scoring_profile must not be empty")
        elif not ID_PATTERN.match(scoring_profile):
            errors.append(
                f"{rel}: invalid scoring_profile '{scoring_profile}' "
                "(use lowercase slug like baseline_v1)"
            )

        category = str(raw.get("category") or "").strip().lower()
        if category and not CATEGORY_PATTERN.match(category):
            errors.append(
                f"{rel}: invalid category '{category}' "
                "(expected lowercase slug 1-32 chars: a-z, 0-9, -, _)"
            )

        priority_raw = raw.get("priority")
        if priority_raw is None or str(priority_raw).strip() == "":
            errors.append(f"{rel}: priority is required for enabled services")
        else:
            try:
                priority_value = _parse_int(priority_raw)
                if priority_value < 0:
                    raise ValueError("must be >= 0")
            except Exception:
                errors.append(f"{rel}: priority must be a non-negative integer")

        for key in ("legacy_href", "detail_path", "status_path"):
            value = str(raw.get(key) or "").strip()
            if value and not _validate_public_path(value):
                errors.append(f"{rel}: {key} must start with '/': '{value}'")

        icon_name = str(raw.get("icon") or "").strip()
        if icon_name and icon_name not in ALLOWED_ICON_NAMES:
            allowed = ", ".join(sorted(ALLOWED_ICON_NAMES))
            errors.append(f"{rel}: unsupported icon '{icon_name}' (allowed: {allowed})")

        aliases = _parse_csv(raw.get("aliases"))
        seen_aliases_local: set[str] = set()
        for alias in [service_id, *aliases]:
            lowered = str(alias).strip().lower()
            if not lowered:
                continue
            if not ALIAS_PATTERN.match(lowered):
                errors.append(
                    f"{rel}: invalid alias '{alias}' "
                    "(expected lowercase slug 1-64 chars: a-z, 0-9, -, _)"
                )
                continue
            if lowered in seen_aliases_local:
                continue
            seen_aliases_local.add(lowered)

            owner = alias_to_owner.get(lowered)
            if owner and owner != service_id:
                errors.append(f"{rel}: alias '{lowered}' already used by service '{owner}'")
            else:
                alias_to_owner[lowered] = service_id

        tags = _parse_csv(raw.get("tags"))
        seen_tags_local: set[str] = set()
        for tag in tags:
            lowered = str(tag).strip().lower()
            if not lowered:
                continue
            if not TAG_PATTERN.match(lowered):
                errors.append(
                    f"{rel}: invalid tag '{tag}' "
                    "(expected lowercase slug 1-32 chars: a-z, 0-9, -, _)"
                )
                continue
            if lowered in seen_tags_local:
                errors.append(f"{rel}: duplicate tag '{lowered}'")
                continue
            seen_tags_local.add(lowered)

        if home_enabled:
            home_order_raw = raw.get("home_order")
            if home_order_raw is None or str(home_order_raw).strip() == "":
                errors.append(f"{rel}: home_order is required when home_enabled=true")
            else:
                try:
                    home_order = _parse_int(home_order_raw)
                    if home_order < 0:
                        raise ValueError("must be >= 0")
                except Exception:
                    errors.append(f"{rel}: home_order must be a non-negative integer")
                else:
                    previous_owner = home_orders.get(home_order)
                    if previous_owner and previous_owner != service_id:
                        errors.append(
                            f"{rel}: home_order '{home_order}' already used by service '{previous_owner}'"
                        )
                    else:
                        home_orders[home_order] = service_id

    if enabled_count == 0:
        errors.append("No enabled service configs found.")
    return errors


def main() -> int:
    args = _parse_args()
    config_dir = Path(str(args.config_dir)).resolve()
    errors = validate_service_configs(config_dir=config_dir)
    if errors:
        print("[service-config] validation failed:")
        for error in errors:
            print(f" - {error}")
        return 1

    files_count = len(list(config_dir.glob("*.yaml"))) + len(list(config_dir.glob("*.yml")))
    print(f"[service-config] validation passed ({files_count} files).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
