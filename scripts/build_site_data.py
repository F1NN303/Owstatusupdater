import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ow_aggregator import build_dashboard_payload


def main() -> None:
    payload = build_dashboard_payload(force_refresh=True)
    out_path = Path("site/data/status.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} with health={payload.get('health')}")


if __name__ == "__main__":
    main()
