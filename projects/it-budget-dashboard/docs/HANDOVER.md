# Handover: IT Budget Dashboard prototype

For the Claude Code installation (and the people) taking this prototype onto the company network and GitLab.

## 1. Goal

A visualisation app for next year's corporate IT budget covering **licences, services and contracts**. The input is a spreadsheet with the budget for next year. The app will eventually be deployed through company GitLab (most likely GitLab Pages behind access control). This phase is a **local prototype**: static HTML pages and Markdown docs, built and tested outside the company network with fictional data.

## 2. Current status

| Area | State |
|---|---|
| Spreadsheet → data pipeline (`scripts/build_data.py`) | ✅ Done. Stdlib-only Python. Reads .xlsx/.csv, validates, writes `site/data.js` and `reports/validation-report.md`. |
| Dashboard (`site/`) | ✅ Done. 7 sections, global filters with URL state, drill-down, CSV export, light/dark, works from `file://`. |
| Input template + fictional sample | ✅ `data/budget-template.xlsx`, `data/sample-budget.xlsx/.csv` |
| Tests | ✅ 11 unit tests (`python3 -m unittest discover -s tests`). ✅ Browser smoke test (`node tests/smoke_test.cjs`, needs Playwright). Both passed when handed over. |
| Docs | ✅ README, data schema, design principles with sources, GitLab deployment guide |
| GitLab pipeline | ⚠️ Draft only (`docs/gitlab-ci.example.yml`). **Never run.** |
| Real company data | ❌ Not seen. The column contract is a proposal and must be checked against the real budget spreadsheet. |

## 3. Key decisions (and why)

1. **Static site, no server.** GitLab Pages only serves static files. The data is small (hundreds to low thousands of rows), so there's no need for a database or backend. Streamlit or Dash were rejected because they need hosting.
2. **No external dependencies at runtime.** Vanilla JS, hand-built SVG and HTML charts, system fonts. No CDN, chart library or `npm install`. This avoids problems with blocked CDNs or proxies on the company network and keeps budget data in the browser.
3. **Python standard library only for the build**, including a small built-in .xlsx reader, so it runs on locked-down laptops and minimal CI images. `openpyxl` is only used by `make_sample_data.py` to *write* the sample and template.
4. **`data.js`, not `data.json`.** Browsers block `fetch()` of local files on `file://`. A script tag works everywhere.
5. **Validation gates publishing.** Errors stop the build and the old `data.js` is kept. Warnings are surfaced in the UI, not hidden.
6. **One reporting currency.** Mixed currencies are an error. FX conversion is deliberately left to Finance before import.
7. **The notice deadline is the key renewal date** (renewal − notice period), because auto-renewal windows are where savings are lost.
8. **Blank prior-year figure = new spend; budget 0 with a prior figure = removed.** This makes the prior-year bridge reconcile exactly. Document it for users.
9. Horizontal bars over pies and treemaps; zero-based axes; fixed category colours. See `design-principles.md`.

## 4. First tasks on the company side

1. **Get the real budget spreadsheet** (or an anonymised copy) and compare it to `docs/data-schema.md`. Then either:
   - map its columns with `HEADER_ALIASES` / `CATEGORY_ALIASES` in `scripts/build_data.py` (preferred: don't make Finance change their format), or
   - agree on the template with Finance.
   Rebuild and review `reports/validation-report.md`.
2. Confirm the open questions in §6 with the owner.
3. Set up the GitLab project and pipeline following `docs/gitlab-deployment.md`. **Turn on Pages access control before the first deploy.**
4. Run both test suites in the company environment. If Playwright isn't available, the Python tests are enough for CI.

## 5. Roadmap / ideas not yet built

Ordered roughly by expected value:

- **Licence utilisation:** add `licences_used` (or import from SAM/SaaS-management tools) and show bought vs used, cost of unused seats, and price per *active* user.
- **Budget vs actuals during the year:** add a second input (ERP/GL export by month), and show actual vs phased budget and forecast to year end.
- **Scheduled rebuilds** so renewal urgency stays current, or compute it in the browser from today's date.
- **Multi-currency** with an FX table (`fx_rates.csv`) and a stated rate date.
- **Contract documents:** link `line_id` to a contract-repository URL column.
- **Per-audience builds**, if owners must only see their own lines (a static site can't enforce row-level security).
- Proper TBM tower/sub-tower mapping once Finance agrees the taxonomy.
- Print/PDF view for budget committee packs.

## 6. Open questions for the owner

1. GitLab.com or self-managed? Is Pages with access control available?
2. Who is the audience: CIO/CFO (summary-first) or budget owners (line-first)? Do owners need restricted views?
3. Are prior-year budget and/or actuals available in the same sheet?
4. One currency? Which one? Are VAT and inflation included?
5. What cost-pool and tower lists does Finance use today?
6. Who approves budget updates (the MR approver)?

## 7. How to verify it still works

```bash
python3 scripts/build_data.py data/sample-budget.xlsx --as-of 2026-11-07 --year 2027
```

```bash
python3 -m unittest discover -s tests -v
```

```bash
node tests/smoke_test.cjs
```

Expected results: `✓ 41 lines, total 5,517,000 EUR, 6 warning(s)`, 11 tests OK, and "all checks passed". Then open `site/index.html`.
