# Overwatch Status Radar

Website that shows:
- Overwatch outage signals (StatusGator, Downdetector-like)
- Blizzard forum status reports (Technical Support + Bug Report)
- Official Overwatch news
- Best-effort social updates

## GitHub Pages mode

This repo includes a static site in `site/` for GitHub Pages:
- `site/index.html`
- `site/styles.css`
- `site/app.js`
- `site/data/status.json`

`site/data/status.json` is refreshed by GitHub Actions every 30 minutes using:
- `.github/workflows/update-site-data.yml`
- `requirements.site.txt` (minimal deps for the updater job)

Pages deploy is handled by:
- `.github/workflows/deploy-pages.yml`

### Required GitHub settings

1. Go to `Settings` -> `Pages`.
2. Set **Source** to **GitHub Actions**.
3. Ensure Actions are allowed in repo settings.

Then your URL will be:
- `https://<username>.github.io/<repo>/`

## Local run (Flask backend, optional)

```bash
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`.

## Notes

- GitHub Pages is static only, so live external fetching runs in GitHub Actions and writes JSON into the repo.
- If your repository stays private, GitHub Pages availability depends on your GitHub plan.

## Security Hardening

- No webhook/token/API key values are committed in source.
- Legacy uploaded archive `mc-regeln-main.zip` was removed from the main branch tip.
- Legacy Discord posting workflow was removed from the main branch tip.
- The data refresh workflow installs only minimal dependencies (`requirements.site.txt`) to reduce supply-chain exposure.
