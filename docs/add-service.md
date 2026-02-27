# Add A New Service

This project is configuration-driven for service registration.

## Goal
Add a new service with one config file edit for registration/discovery.

Important:
- Service registration is config-driven.
- Data workflows build all enabled services via `--service all`.
- Home/discovery metadata comes from `site/data/services-manifest.json`.

## 1) Create service config
1. Copy `config/services/_template.yaml` to `config/services/<service-id>.yaml`.
2. Set:
   - `id`: lowercase slug (for example `discord`)
   - `builder`: Python target in `module.path:function_name` format
   - `site_url`: public URL root for this service page
   - `data_dir`: must be under `site/.../data`
   - `state_path`: must be under `.bot_state/...json`
   - `scoring_profile`: lowercase slug (for example `baseline_v1`)
   - `home_order`, `priority`, `category`, `icon`, `aliases`, `tags`, `note`
3. Set `enabled: true`.
4. Set `home_enabled: true` if it should appear on Home/manifest.

## 2) Validation
Run:

```powershell
py -3 scripts/validate_services.py
```

This validates config contract, builder target shape/import, paths, alias collisions, and UI metadata.

## 3) Build data locally
Build only your service:

```powershell
py -3 scripts/build_site_data.py --service <service-id>
```

Build all enabled services:

```powershell
py -3 scripts/build_site_data.py --service all
```

## 4) Required output contract
Your builder must return payload compatible with existing pipeline expectations used by:
- `status.json`
- `history.json`
- `summary.json`
- `rss.xml`
- `alerts.json`

See tests:
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

## 5) Frontend compatibility
No core frontend edits are required for service discovery if config metadata is present.

Manifest-driven fields used by Home/detail:
- `id`, `label`, `display_name`
- `detail_path`, `status_path`, `legacy_href`
- `icon`, `aliases`, `category`, `priority`, `tags`, `note`

## 6) CI behavior
- Data workflows stage only config-driven service data paths from `scripts/list_service_data_paths.py`.
- Deploy workflow validates service configs before build.
- Any invalid service config fails CI.

## 7) Ship checklist
Run before commit:

```powershell
py -3 scripts/validate_services.py
py -3 -m unittest discover -s tests -p "test_*.py" -v
py -3 scripts/check_public_exposure.py
npm.cmd run build
```

