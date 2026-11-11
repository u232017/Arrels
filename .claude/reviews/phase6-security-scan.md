# Security scan — Arrels MVP

**Date:** 2026-11-11 · **Scope:** whole repo + full Git history

## AgentShield

`npx ecc-agentshield@1.6.0 scan --path .` was **not run**: the session's auto-mode permission check
blocked executing the downloaded package. Run it yourself before pushing:

```bash
npx --yes ecc-agentshield@1.6.0 scan --path . --format text
```

## Project checks (run locally)

| Check | Result |
|---|---|
| Data files ever committed (all branches, all history) | Only `data/raw/README.md`, `data/processed/README.md` |
| Telefónica-style rows (`YYYY-MM-DD,<día>,...`) in tracked files | None |
| Hard-coded secrets (key/secret/password/token patterns) | None |
| `.env`, Parquet, XLSX tracked | None (`.env.example` only) |
| Exported counts < 15 (real export + sample) | None |
| XSS sinks in web (`dangerouslySetInnerHTML`, `innerHTML`, `eval`) | None |
| SQL built from user input | None (no user input; paths/identifiers quoted via `pipeline/sql.py`) |
| Loaded JSON validated in the browser | Yes (ajv against `contract/arrels.schema.json`) |
| `pip-audit -r requirements.txt` | No known vulnerabilities |
| `npm audit --omit=dev` (what ships) | **0 vulnerabilities** |
| `npm audit` (incl. dev tools) | 13 → **7** after upgrades; all 7 in the test runner (vitest 3, tinypool, coverage) |

## Fixed in this pass

- `maplibre-gl` 4.7.1 → 6.16.0 (GHSA-jrc7-96c5-q579, XSS sanitizer bypass). The page did not use
  the affected `setHTML`/popup path, but it ships to users, so it was upgraded. MapLibre 6 needs its
  worker loaded explicitly; fixed and covered by a new e2e test.
- `vite` 6.4.5, `vitest`/`coverage-v8` 3.2.7, `@vitejs/plugin-react` 4.7.0, `@playwright/test` 1.64.1,
  `ajv` 8.20.0. Every pin is at least two weeks old.

## Accepted risk

- 7 dev-only findings in Vitest 3 (2 critical: tinypool prototype-pollution gadget, Vitest API/UI
  server file read). They need Vitest ≥ 4 (major). The team never runs Vitest UI/API server and tests
  only execute this repo's own files. Revisit after the 04/12 deadline (BACKLOG).
- The basemap loads from OpenFreeMap (third-party, no key). If it is down, the ranked list remains.
