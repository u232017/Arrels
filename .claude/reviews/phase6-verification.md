# Verification loop — Arrels MVP

**Date:** 2026-11-11 · **Commit:** after `316366f`

```
VERIFICATION REPORT
==================

Build:     PASS (vite build; web/dist 2.6 MB incl. 580 KB data)
Types:     PASS (tsc strict: 0 errors; mypy pipeline: 0 issues in 14 files)
Lint:      PASS (ruff); no ESLint configured for web/ (backlog T2)
Tests:     PASS (pytest 134/134, 91.9% coverage; vitest 55/55, 99.8% lines;
                 playwright 14/14 on dev server and on the production build)
Security:  PASS with notes (no secrets, no data in Git history, no XSS sinks, pip-audit clean,
                 npm audit --omit=dev 0; 7 dev-only vitest findings accepted; AgentShield not run)
Diff:      92 files changed vs main

Overall:   READY for PR
```

## Fresh-clone reproducibility (scratchpad clone of the branch)

| Step | Result |
|---|---|
| Tracked data-like files | none |
| `make setup` | 19 s |
| `make test` | 134 passed, 91.9 % |
| `make data` (cold, 15 GB) | 42 s |
| `make notebook` (cache) | 11 s |
| `npm ci` + vitest / e2e on build / build | 55 / 14 / ok |
| Gap found | `make setup` did not install web deps → fixed in `d7e9422` |
