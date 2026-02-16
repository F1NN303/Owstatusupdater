# Overwatch Status Radar

Flask website that aggregates:
- Overwatch outage signals (StatusGator, Downdetector-like)
- Blizzard forum status reports (Technical Support + Bug Report)
- Official Overwatch news
- Best-effort social updates

## Local run

```bash
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## Deploy (Render)

This repo includes `render.yaml`, so Render can auto-detect settings.

1. Push this project to your GitHub repo.
2. In Render: `New +` -> `Blueprint`.
3. Select your GitHub repo.
4. Render creates and deploys `overwatch-status-radar`.
5. You get a permanent HTTPS URL.

## API

- `GET /` -> dashboard UI
- `GET /api/status` -> aggregated JSON payload
- `GET /api/status?refresh=1` -> force fresh source fetch
