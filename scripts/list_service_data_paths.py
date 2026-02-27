from __future__ import annotations

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SERVICE_CONFIG_DIR = ROOT / "config" / "services"
SERVICE_CONFIG_GLOBS = ("*.yaml", "*.yml")
MANIFEST_PATH = Path("site/data/services-manifest.json")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="List generated service data paths for git staging.")
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
            raise ValueError(f"Invalid line in {path}: '{raw_line}'")
        key, value_raw = line.split(":", 1)
        key = key.strip()
        value_text = value_raw.strip()
        if not key:
            raise ValueError(f"Missing key in {path}: '{raw_line}'")
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


def _parse_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    lowered = str(value).strip().lower()
    if lowered in {"1", "true", "yes", "on"}:
        return True
    if lowered in {"0", "false", "no", "off"}:
        return False
    return default


def _normalize_relative(path_text: str) -> str:
    normalized = str(path_text or "").strip().replace("\\", "/").strip("/")
    return normalized


def list_service_data_paths(config_dir: Path) -> list[str]:
    files: list[Path] = []
    for pattern in SERVICE_CONFIG_GLOBS:
        files.extend(sorted(config_dir.glob(pattern)))

    data_paths: set[str] = set()
    for config_path in sorted({file.resolve() for file in files}):
        raw = _parse_flat_yaml(config_path)
        if not _parse_bool(raw.get("enabled"), default=True):
            continue
        data_dir = _normalize_relative(str(raw.get("data_dir") or ""))
        if not data_dir:
            continue
        if not data_dir.startswith("site/"):
            continue
        data_paths.add(data_dir)

    data_paths.add(_normalize_relative(str(MANIFEST_PATH)))
    return sorted(data_paths)


def main() -> int:
    args = _parse_args()
    config_dir = Path(str(args.config_dir)).resolve()
    for path in list_service_data_paths(config_dir):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
