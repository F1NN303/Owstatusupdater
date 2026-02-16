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

## Brevo Email Alerts (Major Outages)
The repository supports automatic email notifications via Brevo when status severity reaches `major`.

### 1. Create Brevo credentials
1. In Brevo, create a transactional email API key.
2. Add and verify your sender identity (single sender or domain).

### 2. Add GitHub Secrets
In `Repository -> Settings -> Secrets and variables -> Actions`, add:
- `BREVO_API_KEY`
- `ALERT_EMAIL_FROM` (verified sender email in Brevo)
- `ALERT_EMAIL_TO` (comma-separated recipients)

### 3. Automatic sending
- Workflow: `.github/workflows/update-site-data.yml`
- Cadence: every 30 minutes
- Script: `scripts/send_brevo_major_alert.py`
- Behavior:
  - sends when severity is `major`,
  - deduplicates repeated snapshots,
  - applies cooldown (`ALERT_MAJOR_COOLDOWN_MINUTES`, default `360`).

### 4. Send a test mail anytime
- Run workflow `Send Test Email Alert` from the Actions tab.
- It force-sends a test message without waiting for a real major outage.

## Local preview
```bash
python -m http.server 8000 --directory site
```

Open `http://127.0.0.1:8000`.
