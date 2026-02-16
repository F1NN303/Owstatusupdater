# Overwatch Status Radar

Public status dashboard for Overwatch service health.

## What it shows
- Service status summary
- Recent incident signals
- Blizzard forum status reports
- Official news and social updates

## Live website
`https://f1nn303.github.io/Owstatusupdater/`

## For maintainers
1. Open `Settings` -> `Pages`
2. Set source to `GitHub Actions`
3. Run the data update/deploy workflows when needed

## Local preview
```bash
python -m http.server 8000 --directory site
```

Open `http://127.0.0.1:8000`.
