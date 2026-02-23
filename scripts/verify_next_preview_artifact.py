from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SITE_NEXT = ROOT / "site" / "next"
INDEX_HTML = SITE_NEXT / "index.html"
EXPECTED_BASE = "/Owstatusupdater/next/"


def fail(message: str) -> None:
    print(f"[verify-next] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        fail(f"Missing file: {path}")
    except Exception as exc:  # pragma: no cover
        fail(f"Failed to read {path}: {exc}")


def extract_asset_paths(html: str) -> tuple[list[str], list[str]]:
    script_paths = re.findall(r'<script[^>]+src="([^"]+)"', html, flags=re.IGNORECASE)
    style_paths = re.findall(
        r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',
        html,
        flags=re.IGNORECASE,
    )
    return script_paths, style_paths


def assert_path_prefix(paths: list[str], kind: str) -> None:
    if not paths:
        fail(f"No {kind} paths found in {INDEX_HTML}")
    for path in paths:
        if not path.startswith(f"{EXPECTED_BASE}assets/"):
            fail(f"{kind} path uses unexpected base: {path}")
        if path.startswith("/assets/"):
            fail(f"{kind} path incorrectly points to root assets: {path}")


def assert_assets_exist(paths: list[str]) -> None:
    for path in paths:
        relative = path.removeprefix(EXPECTED_BASE)
        file_path = SITE_NEXT / relative
        if not file_path.is_file():
            fail(f"Referenced asset missing from site/next: {path} -> {file_path}")


def assert_favicon(html: str) -> None:
    match = re.search(r'<link[^>]+rel="icon"[^>]+href="([^"]+)"', html, flags=re.IGNORECASE)
    if not match:
        fail("Missing favicon link in site/next/index.html")
    href = match.group(1)
    expected = f"{EXPECTED_BASE}favicon.ico"
    if href != expected:
        fail(f"Unexpected favicon href: {href} (expected {expected})")
    if not (SITE_NEXT / "favicon.ico").is_file():
        fail("Missing site/next/favicon.ico")


def assert_source_contracts() -> None:
    # These source-level checks catch the exact regressions we recently hit.
    vite_config = read_text(ROOT / "react-next" / "vite.config.ts")
    if "/Owstatusupdater/next/" not in vite_config:
        fail("react-next/vite.config.ts is missing the production /Owstatusupdater/next/ base default")

    app_tsx = read_text(ROOT / "react-next" / "src" / "App.tsx")
    if "HashRouter" not in app_tsx:
        fail("react-next/src/App.tsx no longer imports HashRouter")
    if "import.meta.env.PROD" not in app_tsx:
        fail("react-next/src/App.tsx missing production router default logic")

    legacy_site = read_text(ROOT / "react-next" / "src" / "lib" / "legacySite.ts")
    required_markers = [
        "import.meta.env.BASE_URL",
        "inferLegacyBasePathFromBaseUrl",
        'endsWith("/next")',
    ]
    for marker in required_markers:
        if marker not in legacy_site:
            fail(f"react-next/src/lib/legacySite.ts missing expected marker: {marker}")


def main() -> None:
    html = read_text(INDEX_HTML)
    script_paths, style_paths = extract_asset_paths(html)

    assert_path_prefix(script_paths, "script")
    assert_path_prefix(style_paths, "stylesheet")
    assert_assets_exist(script_paths + style_paths)
    assert_favicon(html)
    assert_source_contracts()

    print("[verify-next] OK: /next artifact paths and preview routing/data path contracts look valid.")


if __name__ == "__main__":
    main()
