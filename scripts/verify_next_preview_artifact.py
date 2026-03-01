from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SITE_ROOT = ROOT / "site"
SITE_NEXT = ROOT / "site" / "next"
ROOT_INDEX_HTML = SITE_ROOT / "index.html"
INDEX_HTML = SITE_NEXT / "index.html"
EXPECTED_BASE = "/Owstatusupdater/next/"
EXPECTED_ROOT_BASE = "/Owstatusupdater/"
SERVICE_BRANDING_TS = ROOT / "react-next" / "src" / "lib" / "serviceBranding.ts"


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


def assert_path_prefix(paths: list[str], kind: str, expected_base: str, disallow_root_assets: bool = False) -> None:
    if not paths:
        fail(f"No {kind} paths found")
    for path in paths:
        if not path.startswith(f"{expected_base}assets/"):
            fail(f"{kind} path uses unexpected base: {path} (expected prefix {expected_base}assets/)")
        if disallow_root_assets and path.startswith("/assets/"):
            fail(f"{kind} path incorrectly points to root assets: {path}")


def assert_assets_exist(paths: list[str], site_dir: Path, expected_base: str) -> None:
    for path in paths:
        relative = path.removeprefix(expected_base)
        file_path = site_dir / relative
        if not file_path.is_file():
            fail(f"Referenced asset missing: {path} -> {file_path}")


def assert_favicon(html: str, expected_href: str, site_dir: Path) -> None:
    match = re.search(r'<link[^>]+rel="icon"[^>]+href="([^"]+)"', html, flags=re.IGNORECASE)
    if not match:
        fail("Missing favicon link in index.html")
    href = match.group(1)
    if href != expected_href:
        fail(f"Unexpected favicon href: {href} (expected {expected_href})")
    if not (site_dir / "favicon.ico").is_file():
        fail(f"Missing {site_dir / 'favicon.ico'}")


def extract_service_brand_assets(source: str) -> list[str]:
    return re.findall(r'assetPath:\s*"([^"]+)"', source)


def assert_service_brand_assets() -> None:
    source = read_text(SERVICE_BRANDING_TS)
    assets = sorted(set(extract_service_brand_assets(source)))
    if not assets:
        return
    for rel in assets:
        root_path = SITE_ROOT / rel
        next_path = SITE_NEXT / rel
        if not root_path.is_file():
            fail(f"Missing root brand asset from build output: {root_path}")
        if not next_path.is_file():
            fail(f"Missing preview brand asset from build output: {next_path}")


def assert_root_artifact() -> None:
    html = read_text(ROOT_INDEX_HTML)
    if 'http-equiv="refresh"' in html.lower():
        fail("site/index.html is still a redirect page; expected React root build")
    if '<div id="root"></div>' not in html:
        fail("site/index.html does not look like the React root shell")

    script_paths, style_paths = extract_asset_paths(html)
    assert_path_prefix(script_paths, "root script", EXPECTED_ROOT_BASE)
    assert_path_prefix(style_paths, "root stylesheet", EXPECTED_ROOT_BASE)
    assert_assets_exist(script_paths + style_paths, SITE_ROOT, EXPECTED_ROOT_BASE)
    assert_favicon(html, f"{EXPECTED_ROOT_BASE}favicon.ico", SITE_ROOT)


def assert_next_preview_artifact() -> None:
    html = read_text(INDEX_HTML)
    script_paths, style_paths = extract_asset_paths(html)

    assert_path_prefix(script_paths, "preview script", EXPECTED_BASE, disallow_root_assets=True)
    assert_path_prefix(style_paths, "preview stylesheet", EXPECTED_BASE, disallow_root_assets=True)
    assert_assets_exist(script_paths + style_paths, SITE_NEXT, EXPECTED_BASE)
    assert_favicon(html, f"{EXPECTED_BASE}favicon.ico", SITE_NEXT)


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
    assert_root_artifact()
    assert_next_preview_artifact()
    assert_service_brand_assets()
    assert_source_contracts()

    print("[verify-next] OK: root + /next artifact paths and preview routing/data path contracts look valid.")


if __name__ == "__main__":
    main()
