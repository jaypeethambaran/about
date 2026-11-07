# CLAUDE.md: IT Budget Dashboard

Guidance for AI assistants working on this project. **Read `docs/HANDOVER.md` first.** It covers the goal, current status, decisions and next steps.

## What this is

A static, offline dashboard for next year's IT licences, services and contracts budget. Input: spreadsheet. Build: `scripts/build_data.py` (Python stdlib) → `site/data.js`. View: open `site/index.html` from disk. Target deployment: company GitLab Pages with access control (see `docs/gitlab-deployment.md`).

## Commands

```bash
python3 scripts/build_data.py data/sample-budget.xlsx --as-of 2026-11-07 --year 2027   # rebuild sample data
python3 -m unittest discover -s tests -v                                               # unit tests
node tests/smoke_test.cjs                                                              # browser test (needs Playwright)
python3 scripts/make_sample_data.py                                                    # regenerate sample/template (needs openpyxl)
```

Run the unit tests after any change to `build_data.py`. Run the smoke test after any change to `site/`, and look at a screenshot (`SCREENSHOT_DIR=… node tests/smoke_test.cjs`) for visual changes.

## Constraints to keep

- **No runtime dependencies or network requests** in `site/`: no CDNs, chart libraries, web fonts or analytics. The company network may block them, and the data is confidential.
- **No third-party Python packages** in `build_data.py`. It must run on a bare Python 3.9+.
- The page must keep working from `file://`. Don't switch to `fetch()` unless the app is only ever served over HTTP.
- `site/data.js` is generated. Never edit it by hand.
- If you add or rename a spreadsheet column, update `docs/data-schema.md`, the template generator in `scripts/make_sample_data.py` (and regenerate), and the tests together.
- Keep colours consistent across charts (category colours are CSS variables in `site/styles.css`) and keep both light and dark themes working.
- No horizontal page scroll at 390 px width (checked by the smoke test).

## Data and privacy

- **Never commit real budget or contract data** to a repository that isn't private and access-controlled. Put local real files in `data/private/` (git-ignored).
- The sample data is fictional (invented vendor names). Keep it that way.
- Before the first GitLab Pages deploy, confirm Pages access control is on. Pages sites can otherwise be public.

## Code map

- `scripts/build_data.py`: `read_xlsx`/`read_csv` → `build()` (all validation rules) → `write_data_js()` and `render_report()`
- `site/app.js`: one IIFE. Sections: helpers, state and filters (URL hash), KPIs, bar lists, renewals (timeline + table), phasing, bridge, line items (+ CSV export), data quality, page chrome. `window.BudgetDashboard` is exposed for tests.
- `site/styles.css`: design tokens at the top (`:root`, dark overrides), then components.
