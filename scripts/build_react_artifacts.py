from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
REACT_DIR = ROOT / "react-next"
DIST_DIR = REACT_DIR / "dist"
SITE_DIR = ROOT / "site"
SITE_NEXT_DIR = SITE_DIR / "next"
ROOT_STATIC_FILES = ("index.html", "favicon.ico", "placeholder.svg", "robots.txt")


def run(cmd: list[str], cwd: Path, extra_env: dict[str, str] | None = None) -> None:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    if os.name == "nt" and cmd and cmd[0] == "npm":
        cmd = ["npm.cmd", *cmd[1:]]
    print(f"[build-react] run: {' '.join(cmd)} (cwd={cwd})")
    subprocess.run(cmd, cwd=cwd, env=env, check=True)


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def replace_dir(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def ensure_dist() -> None:
    if not DIST_DIR.is_dir():
        raise FileNotFoundError(f"Missing dist output: {DIST_DIR}")
    if not (DIST_DIR / "assets").is_dir():
        raise FileNotFoundError(f"Missing dist assets: {DIST_DIR / 'assets'}")


def sync_root_site() -> None:
    ensure_dist()
    replace_dir(DIST_DIR / "assets", SITE_DIR / "assets")
    for name in ROOT_STATIC_FILES:
        src = DIST_DIR / name
        if src.exists():
            copy_file(src, SITE_DIR / name)


def sync_preview_site() -> None:
    ensure_dist()
    if SITE_NEXT_DIR.exists():
        shutil.rmtree(SITE_NEXT_DIR)
    SITE_NEXT_DIR.mkdir(parents=True, exist_ok=True)
    replace_dir(DIST_DIR / "assets", SITE_NEXT_DIR / "assets")
    for name in ROOT_STATIC_FILES:
        src = DIST_DIR / name
        if src.exists():
            copy_file(src, SITE_NEXT_DIR / name)


def build(base_path: str) -> None:
    run(["npm", "run", "build"], cwd=REACT_DIR, extra_env={"VITE_APP_BASE_PATH": base_path})


def main() -> int:
    if not REACT_DIR.is_dir():
        print(f"[build-react] ERROR: missing react app dir: {REACT_DIR}", file=sys.stderr)
        return 1

    print("[build-react] Building root artifact (/Owstatusupdater/)")
    build("/Owstatusupdater/")
    sync_root_site()

    print("[build-react] Building preview artifact (/Owstatusupdater/next/)")
    build("/Owstatusupdater/next/")
    sync_preview_site()

    print("[build-react] OK: root + preview artifacts updated in site/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
