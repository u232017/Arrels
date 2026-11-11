# Code review — Arrels MVP (branch stack → main)

**Date:** 2026-11-11 · **Scope:** 84 files changed vs `main` (pipeline/, tests/, web/, contract/, docs/)
**Decision:** APPROVE with comments (no CRITICAL/HIGH open)

## Earlier specialist reviews (all findings fixed, regression tests added)

| Review | Main findings | Status |
|---|---|---|
| python-reviewer | SQL path quoting, unvalidated join identifiers, float sum compare, cache version | fixed (`fix/phase2-review`) |
| database-reviewer | CSV parsed twice, ORDER BY spill, double-counted route-days, NULL contract hole | fixed (`fix/phase2-review`) |
| typescript-reviewer | stale barri responses, range not re-fitted, unvalidated JSON, map effect loop | fixed (`fix/web-review`) |

## This pass (checklist sweep)

| Severity | Finding | Action |
|---|---|---|
| CRITICAL | None (no secrets, no data files except 2 public reference CSVs, no `any`, no XSS sinks) | — |
| HIGH | None | — |
| MEDIUM | `web/src/App.tsx` component was 98 lines (data loading + layout) | Split into `useArrelsData` hook + `BarriView` (fixed) |
| MEDIUM | `pipeline/indicators.py:weekend_share` (66 lines) and `pipeline/pilot.py:barri_sufficiency` (55 lines) exceed 50 lines | Accepted: almost all of it is one documented SQL statement; splitting the CTEs would hurt readability |
| LOW | `print` in `pipeline/centroids.py` CLI | Switched to logging (fixed) |
| LOW | `BarriView`, `TimeSeries`, `HomesMap` are 54–63 lines, mostly JSX | Accepted |

## Validation

| Check | Result |
|---|---|
| ruff | Pass |
| pytest + coverage | 132 passed |
| tsc | Pass |
| vitest | 48 passed |
| playwright (desktop + phone) | 12 passed |
| vite build | Pass |
