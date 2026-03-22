# Status Radar

Public status dashboard for monitored online services and platforms.

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

## AI Assistant Deployment
- Local frontend development can use `react-next/.env.example`, which points to `http://127.0.0.1:3000`.
- GitHub Pages production builds must receive `VITE_AI_API_BASE_URL` from the repo variable `AI_API_BASE_URL`.
- If `AI_API_BASE_URL` is unset, the site still deploys and the assistant shows as unavailable.

## Notes
- Build/deploy and private workflow configuration details are intentionally minimized in this public README.
- If you are a maintainer/agent, use `AGENTS.md` and `docs/AGENT_HANDOFF.md`.
