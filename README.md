# Overwatch Status Radar

Public status dashboard for Overwatch and Sony PSN service health.

## Live Website
- https://f1nn303.github.io/Owstatusupdater/

## What It Shows
- Live service status summary
- Incident and outage signals
- Official news / updates / social links
- E-mail alert signup (Brevo hosted form embedded in app)

## Ownership / Reuse
This project is public for deployment and collaboration, but it is not open source.
See:
- `LICENSE`
- `NOTICE.md`
- `/#/terms` (live app legal page)

## Local Preview (basic)
```bash
python -m http.server 8000 --directory site
```

Open `http://127.0.0.1:8000`.

## Notes
- Build/deploy and private workflow configuration details are intentionally minimized in this public README.
- If you are a maintainer/agent, use `AGENTS.md` and `docs/AGENT_HANDOFF.md`.
