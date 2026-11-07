# IT Budget Explorer: handover for a Gemini agent

You are taking over a working prototype. This document explains what it is, how it is built and what it must keep doing, so you can improve it without breaking anything. Read it end to end before changing code.

**The artifact:** `budget-explorer.html`, one self-contained file of about 1,800 lines and 140 KB, holding HTML, CSS and JavaScript. Open it in a browser and it runs. There is no build step, server, package manager or internet connection involved.

---

## 1. Product context

| | |
|---|---|
| **What it is** | A browser app for exploring next year's **corporate IT budget for licences, services and contracts** |
| **Input** | One or more **CSV files with any column layout**. The app detects what each column means, and the user can correct it. |
| **Users** | IT leadership, IT finance and budget owners. CIO/CFO-level readers want the summary, budget owners want line detail. |
| **Phase** | **UI prototype.** The owner is getting feedback on the interface before moving it into the company's GitLab, most likely served as a static site on GitLab Pages with access control. |
| **Data sensitivity** | Real budgets and contract values are confidential. The app must never send data anywhere. |

### Feedback so far, which shapes what "better" means

1. The first single-page version was rejected as **"not enterprise class"**.
2. The owner asked for **sub-pages with a side panel** and **external best-practice references**.
3. The current version answers that with an enterprise app frame based on public design systems (section 6).
4. **The owner's focus is the UI** and **accepting any CSV**. Keep both central.

---

## 2. Quick start

1. Open `budget-explorer.html` in Chrome, Edge or Firefox. Opening it straight from disk (`file://`) works.
2. Select **Use sample data**. This loads a fictional 41-line budget embedded in the file.
3. Click through every page in the left side panel. Click bars, table rows and timeline dots to open the details panel on the right.
4. Load a real CSV with **Load CSV** in the top bar, or drag files onto the window.

### Expected numbers for the sample data (use these as a regression check)

Set **Data source & columns → Urgency as of = 2026-11-07** first, because renewal urgency depends on that date.

| Check | Expected |
|---|---|
| Total budget (Overview tile) | **5,517,000** across **41** lines and **20** vendors |
| Change vs prior year | **+5.8%** (prior-year total **5,214,500**) |
| New spend | **380,000** from 4 lines with no prior-year figure |
| Category split | Licence 2,245,000 (41%) · Service 1,712,000 (31%) · Contract 1,560,000 (28%) |
| Vendor concentration | Top 5 = 56% of spend; **10 vendors = 80%** |
| Notice deadlines within 90 days | **18**, of which **7 overdue** |
| Data quality | 97% score, 0 errors, **5 warnings** (3 no owner, 1 no cost centre, 1 renewal date passed) |
| Monthly columns detected | 12 (Jan…Dec) |

### Other test files (in the source repo; recreate them if you don't have them)

Repo: `jaypeethambaran/about`, branch `claude/cloud-environment-setup-6a26xz`, folder `projects/it-budget-dashboard/data/`.

- **`sample-budget.csv`:** the same data as the embedded sample. Snake_case headers (`line_id, vendor, product_or_service, category, cost_pool, tower, cost_centre, owner, annual_budget, currency, capex_opex, contract_start, contract_end, renewal_date, auto_renew, notice_period_days, billing_frequency, licence_qty, unit_price, prior_year_budget, jan … dec, notes`).
- **`examples/finance-export-eu.csv`:** the same budget as a European finance export. It has a title row above the header, `;` delimiters, `1.234,50` numbers, `dd.mm.yyyy` dates, and different headers:
  ```
  IT budget export - generated 01.11.2026
  Ref;Supplier;Description;Type;Spend type;Department;Budget holder;Budget FY2026;Budget FY2027;Contract end;Notice (days);Auto renewal;Jan 2027;…;Dec 2027
  IT-001;Northwind Software;Office productivity suite;Licence;Software;IT-Workplace;Head of Workplace;532.500,00;486.000,00;01.03.2027;30;No;0,00;0,00;486.000,00;…
  ```
  Expected: total 5,517,000; amount = `Budget FY2027`, prior = `Budget FY2026`, renewal = `Contract end`, cost centre = `Department`, owner = `Budget holder`, 12 month columns.
- **`examples/minimal-us.csv`:** only three columns, with US currency strings:
  ```
  Vendor,Item,Annual Cost
  Northwind Software,Office productivity suite,"$486,000.00"
  ```
  Expected: total 5,517,000 over 39 rows and currency USD. Renewals, Cash flow, Year over year and Cost centres show an explanation page instead of charts.

---

## 3. Hard constraints (do not break these)

1. **One file, no dependencies.** No CDNs, npm packages, chart libraries, web fonts, analytics or `fetch()` to any URL. The company network may block them, and the data is confidential. Draw charts with hand-built SVG or HTML, as the existing code does.
2. **Works from `file://`.** Don't rely on a server, service workers or ES module imports from other files.
3. **Data never leaves the browser.** `localStorage` holds only UI preferences and column mappings (prefix `itbx2:`), never row data.
4. **Any CSV must still load.** Column detection must stay heuristic and forgiving, and the user must always be able to override it on **Data source & columns**.
5. **Light and dark themes** must both stay correct. All colours come from CSS custom properties on `:root`.
6. **Phone width (390 px): no horizontal page scroll.** Wide tables and charts scroll inside their own container.
7. **Accessibility:**
   - Keyboard reachable rows and chart marks (`tabindex="0"`, Enter to open).
   - `aria-current="page"` on the active nav item.
   - `aria-sort` on sortable headers.
   - The drawer has `role="dialog"`, and Esc closes it.
   - Colour is never the only signal; urgency tags carry text.
8. **Numbers are shown as entered.** There is no VAT, FX or inflation adjustment unless the user asks for it, and the footer says so.
9. **Keep the embedded sample.** The block `<script type="text/plain" id="sample-csv">…</script>` holds the fictional sample CSV. Don't reformat or remove it. All vendor names in it are fictional.
10. **Keep `window.BudgetExplorer`.** It is the hook used by automated tests: `{ S, parseCSV, parseNum, parseDate, guessMapping, computeBridge, loadSample, go }`.

---

## 4. Architecture

### File layout (top to bottom)

| Part | What it contains |
|---|---|
| `<style>` | Design tokens on `:root`, dark overrides (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`), then components: shell, nav, page header, buttons, tags, filter bar, cards, KPI tiles, bars, charts, data table, calendar, drawer, empty states, forms |
| `<body>` | App frame: `.topbar`, `nav#sidenav`, `main#main`, plus `#drawer`, `#scrim`, `#tooltip`, `#toast` and the hidden `input#file-input` |
| `script#sample-csv` | The embedded fictional sample CSV (plain text) |
| `<script>` | One IIFE in eight numbered sections, shown below |

### Script sections

1. **Helpers:** `h()` and `s()` build HTML and SVG elements (`h(tag, attrs, ...children)`; attributes starting with `on` become event listeners). Also `icon()` (inline SVG paths in `ICONS`), formatters (`fmtMoney`, `fmtC` compact, `fmtPct`, `fmtSignedPct`, `fmtDay`), `niceTicks`, the tooltip (`withTip`) and `toast`.
2. **CSV:**
   - `parseCSV(text)` detects the delimiter (`,` `;` tab `|`) and handles quotes and CRLF.
   - It treats the first row filled to at least half the table's width as the header, so title rows are skipped.
   - It drops "Total" rows.
   - `combine()` merges several files by header name and adds a `Source file` column.
3. **Profiling and column detection:**
   - `profile()` classifies each column as `number`, `date` or `text`, and detects the decimal separator and date order per column.
   - `guessMapping()` assigns **roles** (below).
   - `guessCurrency()` detects the currency.
4. **Records:**
   - `buildRecords()` turns rows into records with parsed numbers, dates and quality flags.
   - `computeDims()` chooses which text columns can be grouped and filtered, and which one drives colour.
   - Aggregation helpers: `groupBy`, `urgencyOf`, `computeBridge`, `qualityOf` and `vendorAgg`.
5. **App frame:**
   - The `PAGES` registry, `renderNav`, `renderTopbar` and `pageHeader`.
   - Filters: `matches`, `setFilter`, `filterBar`.
   - The drawer: `openDrawer`, `closeDrawer`, `lineDrawer`, `vendorDrawer`.
6. **Charts and components:**
   - Layout: `card`, `kpi`, `dataTable` with `sortRows`, `segmented`, `tabs`, `emptyState`, `heatCell`.
   - Bars: `hbarList`, `mixBar`.
   - SVG charts: `sparkline`, `columnChart` (stacked, with an optional cumulative line), `waterfall`, `pareto`, `ring` and `timeline`.
7. **Pages:** one `pageX(recs)` function per page, plus `insX(recs)` for the one-line finding in each page header.
8. **Rendering, routing and loading:**
   - `render()`, `route()` and `go(id)`.
   - Applying settings: `apply()`.
   - Loading: `load()`, `readFiles()`, `loadSample()`.
   - `exportCsv()`, followed by the event wiring.

### Rendering model (important)

- **Everything is re-rendered on every state change.** `render()` rebuilds the nav, top bar and whole page into `#main`. Interaction handlers mutate state (`S`) and call `render()`. There is no virtual DOM.
- **Focus is restored by element id after each render.** Any control that triggers `render()` while the user is in it, such as a select, the search box or segmented buttons, **needs a stable `id`**, or keyboard users lose their place.
- **Routing:** `location.hash` is `#/overview`, `#/vendors` and so on, and `hashchange` calls `route()`. Filters are *not* in the URL yet.
- **The drawer** is built when opened and isn't re-rendered with the page. It shows a snapshot.

### State: the `S` object

```js
S = {
  loaded, files, fileInfo, headers, rows,        // raw data (rows = arrays of strings)
  prof,                                          // per-column profile {header, ci, type, dec, order, filled, uniq, total, month, sample}
  map: { amount: 7, vendor: 1, ... },            // role -> column index
  months: [ci|null × 12],                        // monthly phasing columns, Jan..Dec
  opts: { label, currency, asOf, fyStart, dateOrder, dec },
  recs,                                          // records (below)
  dims, colorDim, colorMap,                      // groupable columns, colour column, value -> palette var
  filters: { [ci]: value }, q, flag,             // global filters, search text, data-quality check filter
  page,                                          // current page id
  ui: { groupBy, splitBy, bdView, *Sort, lPage, lSize, density, renTab, renSeg, yoyTab, drawerReturn }
}
```

**A record** (`S.recs[i]`) contains: `i, row (original strings), amount, prior, renewal (UTC day number), notice, auto (true/false/null), deadline, monthly ([12] or null), flags (Set), vendor, item, owner, costcentre, id`. Use `cell(rec, ci)` to read any column as text (`'(blank)'` when empty).

### Column roles (`ROLES`)

| Role key | Meaning | Detected from header (regex, case-insensitive) |
|---|---|---|
| `amount` (required) | Budget figure that everything adds up | Numeric column matching budget, amount, cost, spend, value, total, FY…. If several contain a year, the **latest year** wins. Otherwise the largest total wins. |
| `prior` | Prior-year amount | prior, previous, last year, PY, actual. Otherwise the second-latest year column. |
| `vendor` | Supplier | vendor, supplier, publisher, provider, manufacturer, partner, company |
| `item` | Product / service | product, service, description, item, application, name. Otherwise the text column with the most distinct values. |
| `category` | Category (drives colour) | categor, `type`, licence type |
| `pool` | Cost pool / spend type | cost pool, spend type, cost type, account |
| `costcentre` | Cost centre / department | cost centre/center, department, business unit, team |
| `owner` | Budget owner | owner, holder, manager, responsible |
| `capex` | CAPEX / OPEX | capex, opex |
| `renewal` | Renewal or end date (date column) | Tried in order: renew → expir → end date / contract end / due |
| `notice` | Notice period in days | notice |
| `auto` | Auto-renews Y/N | auto |
| `id` | Line ID | id, ref, reference, item no |

**Monthly columns** are numeric columns whose header looks like a month: `Jan`, `January 2027`, `2027-01`, `M01`, `P1`.

**Parsing rules:**
- **Numbers:** `1,234.50`, `1.234,50`, `$1,234`, `(1,234)` for negatives and `1234-` are accepted. The decimal separator is detected per column.
- **Dates:** `YYYY-MM-DD`, `d/m/yyyy`, `d.m.yyyy`, `31 Mar 2027` and `Mar 31, 2027` are accepted. Day/month order is detected per column (day-first unless the data proves otherwise), and two-digit years mean 20xx.

### Definitions used across pages

- **Notice deadline** = renewal date − notice period (days). Without a notice column, it equals the renewal date.
- **Urgency bands**, as days from "as of" to the deadline: overdue (< 0), ≤ 30, 31–60, 61–90, > 90.
- **Year-over-year bridge:**
  - prior year + new (no prior figure) + increases − decreases − removed (amount 0 with a prior figure) = this budget.
  - It must always reconcile exactly.
- **Data-quality score** = share of |spend| in rows with no *error* or *warning* flags. Info flags don't count. The checks are in `CHECKS` as `[key, label, severity]`.
- **Monthly phasing:** rows with month columns use them. Rows without them are spread evenly over 12 months, and the share of spend this affects is always stated.
- **Fiscal year start** (`opts.fyStart`) reorders months on Cash flow and the Overview chart, and defines Q1–Q4.

---

## 5. Pages (the `PAGES` registry)

Each entry is `{ id, label, icon, group, render, insight, needs?, needsText?, noFilters? }`. A page whose `needs()` is false is greyed in the nav. Its page explains which column is missing and links to the mapping form.

| Group | Page | Shows | Needs |
|---|---|---|---|
| Analyse | **Overview** | KPI tiles (total with trend line and change vs prior year, vendors, 90-day deadlines, new spend, quality score), then cards for category mix, top vendors, the first deadlines to act on, monthly cash flow, a mini bridge and data checks. Each card links to its page. | amount |
| Analyse | **Spend breakdown** | **Group by** any column, **Split by** another, and a **View** switch (Chart / Table / Chart + table). Stacked bars plus a cross-table with shaded cells. Clicking filters. | amount |
| Analyse | **Vendors** | Pareto chart (ranked bars, cumulative line, 80% marker) and a vendor table with rank, lines, share, change, category mix, next deadline and owner. A row opens the **vendor details panel**. | vendor |
| Analyse | **Cost centres & owners** | Shaded grid of cost centre × colour column, and an owner table with lines lacking an owner highlighted | cost centre or owner |
| Plan | **Renewals** | Urgency filter buttons, then **Timeline / Calendar / List** tabs. The calendar has 12 month cards grouped by notice-deadline month, plus Overdue and Later cards. | renewal date |
| Plan | **Cash flow** | Monthly stacked columns with a cumulative-% line, and a quarterly summary table | ≥ 2 month columns |
| Plan | **Year over year** | Waterfall bridge, then Increases / Decreases / New / Removed tabs | prior-year amount |
| Data | **Line items** | Every original column, sortable, 25/50/100/250 rows per page, compact or comfortable rows, totals footer. A row opens the **line details panel**. | amount |
| Data | **Data quality** | Score ring, checks by severity and "View rows" (filters Line items to that check) | amount |
| Data | **Data source & columns** | Loaded files, settings (label, currency, number format, date format, as-of date, fiscal-year start) and the column mapping form. Apply / Re-detect. | (always) |

**Global filter bar**, which appears on every page except Data source:
- Up to 6 dropdowns for the main groupable columns, plus a full-text search.
- Active filters appear as removable chips with a "Showing X of Y rows" note.
- Filters persist across pages.

---

## 6. Design system and references

The look follows public enterprise design systems. Keep it consistent with them.

| Reference | What was taken |
|---|---|
| [IBM Carbon: UI shell left panel](https://carbondesignsystem.com/components/UI-shell-left-panel/usage/) | Dark 48 px top bar; left nav with groups and no third level (use tabs inside the page instead); bold active item with a 3 px blue bar; collapses to icons on desktop and behind a menu button below 1056 px |
| [Carbon: dashboards & data visualisation](https://v10.carbondesignsystem.com/data-visualization/dashboards), [chart anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/) | Chart and page titles state the finding; consistent colour per data set; label values directly rather than relying on legends; hierarchy through size and space |
| Carbon data table, tags and **categorical palette** | Grey sticky header, 32–40 px rows, numbers right-aligned with tabular figures, rounded status tags, palette `--c1…--c8` |
| [Fluent 2: Drawer](https://fluent2.microsoft.design/components/web/react/core/drawer/usage), [Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage) | Overlay drawer on the right with header, scrolling body and footer actions; navigation on the left; plain noun labels |
| [SAP Fiori: Analytical list page](https://www.sap.com/design-system/fiori-design-web/v1-136/discover/frameworks/sap-fiori-elements/analytical-list-page-overview-page-sap-fiori-elements-2) | Shared filter header above the content; chart / table / both switch |
| [Atlassian: Page header](https://atlassian.design/components/page-header/usage), empty state | One page header per page (breadcrumb, title, actions); empty states that say what to do next |
| [Azure Cost Management: Cost analysis views](https://learn.microsoft.com/azure/cost-management-billing/costs/cost-analysis-built-in-views) | Named views for each question instead of one giant dashboard |
| Datadog dashboard guidance, FinOps/FOCUS reporting practice | Summary before detail; drill-down with one click; state the cost basis and data freshness (footer) |

**Tokens to reuse rather than hard-coding colours:**

| Token group | Tokens |
|---|---|
| Surfaces | `--bg`, `--layer`, `--layer-2`, `--layer-hover`, `--selected`, `--border`, `--border-strong` |
| Text | `--text`, `--text-2`, `--text-3` |
| Accent | `--primary`, `--primary-weak`, `--link` |
| Data colours | `--bar` (single series), `--other`, `--c1…--c8` (categories), `--up` / `--down` (cost increase red, decrease green) |
| Urgency | `--urg-passed`, `--urg-30`, `--urg-60`, `--urg-90`, `--urg-later` |
| Tags | `--tag-{red,orange,yellow,green,blue,gray,purple}{-bg}` |

**Conventions:**
- Font stack: IBM Plex Sans if installed, then Segoe UI and system UI.
- Radius 4 px, minimal shadows.
- Full-width SVG charts use a 960 px-wide viewBox. Half-width cards use 600 and the drawer 520, so 11 px labels stay readable.
- Display names: snake_case headers become sentence case (`cost_pool` → "Cost pool") through `pretty()` / `hdr()`, and `low()` gives the lower-case form for mid-sentence use. Raw names stay in the mapping form, the export and the footer.

---

## 7. How to make common changes

**Add a page.**
1. Add an entry to `PAGES`, for example `{ id:'contracts', label:'Contracts', icon:'calendar', group:'Plan', render:pageContracts, insight:insContracts, needs:() => S.map.renewal != null, needsText:'a renewal date column' }`.
2. Write `function pageContracts(recs)` returning a node or an array of nodes. Build with `card()`, `dataTable()`, `hbarList()` and so on.
3. Write `function insContracts(recs)` returning one sentence that states the finding.

Use function declarations, not `const` arrow functions, because `PAGES` references them before they're defined.

**Add a column role.**
1. Add `{ key, label, type, re, help }` to `ROLES`.
2. Add the key to the ordered list inside `guessMapping()`.
3. Read it in `buildRecords()` using `txt(row, key)` or `num(row, key)`, and store it on the record.

The mapping form picks it up automatically.

**Add a data-quality check.** Add `[key, label, 'error'|'warning'|'info']` to `CHECKS`, then call `flags.add(key)` in `buildRecords()`. The Data quality page, Overview card, nav badge and score update automatically.

**Add a chart.** Follow `columnChart` or `waterfall`:
1. Build the SVG with `s()` and the y-axis grid with `axisY()`.
2. Use `niceTicks()` for the scale and keep axes zero-based.
3. Add `tabindex:0` and `withTip()` to marks, and Enter/click handlers where a mark opens details.

**Stateful UI controls.** Keep page-level UI state in `S.ui` and give the control a stable `id`, so focus restore works.

**Styling.** Add CSS near the related component block, using tokens only, and check both themes.

---

## 8. Testing and verification

**Automated (in the source repo):** `projects/it-budget-dashboard/tests/explorer_test.cjs`, a Playwright script that opens the file from disk. Run it with `node tests/explorer_test.cjs`, or `SCREENSHOT_DIR=… node tests/explorer_test.cjs` to also save a screenshot of each page. It checks that:
- Every page renders and is marked current in the nav.
- Totals match the expected numbers.
- Group-by, filter chips and the view switch work.
- The vendor panel opens, a line panel opens from inside it, and Esc closes the panel.
- The renewal urgency filter and the calendar work.
- "View rows" filters Line items, and pagination works.
- The EU and minimal CSVs load with the expected column detection.
- Remapping the amount column changes the total (5,214,500) and re-detect restores it.
- There's no horizontal scroll at 390 px, and the phone menu opens.
- There are no console errors.

If you can't run it, do the manual checklist below after every change.

**Manual checklist:**
1. Sample data loads, and the Overview numbers match section 2.
2. Visit every nav item, and check the browser console shows no errors.
3. Clicking a vendor bar adds a filter chip, and all pages respect it. **Clear filters** resets them.
4. A Vendors row opens the panel. Clicking a line inside opens line details. Esc closes the panel, and focus returns to where it was.
5. Renewals: each urgency segment and each tab (Timeline, Calendar, List) shows matching counts.
6. Data source: changing the amount column to `prior_year_budget` and selecting **Apply** gives total 5,214,500. **Re-detect columns** followed by **Apply** restores it.
7. Load the EU and minimal CSVs; check against section 2.
8. Toggle dark mode with the moon icon; check the 390 px phone width.

**Invariants that must always hold:**
- Bridge reconciles: `prior + added + increases − decreases − removed = total`.
- The total tile equals the sum of the Line items table.
- Filtered totals are the same on every page.

---

## 9. Known limitations and technical debt

- **Filters aren't in the URL.** Only the page is, so filtered views can't be bookmarked or shared.
- **Full re-render** on every change is fine up to a few thousand rows. Large files (20k+ rows) will feel slow. There's no table virtualisation or memoisation of aggregates.
- **The drawer doesn't trap focus**: Tab can leave it while it's open.
- **CSV only.** Excel files must be saved as CSV first. A built-in .xlsx reader would need zip decompression (`DecompressionStream`) and XML parsing, with no external libraries.
- **The filter bar shows only the first 6 groupable columns.** Others can still be filtered by clicking bars on Spend breakdown.
- **The colour column is chosen automatically** (category, else cost pool, else CAPEX/OPEX, at most 8 values) and can't be chosen by the user.
- **Ambiguous number `1,234`** is read as one thousand two hundred thirty-four. Two-digit years are assumed to be 20xx. Excel serial dates in CSVs aren't converted.
- **One currency.** There's no FX conversion and no warning when a file mixes currencies.
- **"As of" defaults to today and isn't saved**, so overdue counts change day by day.
- **The Pareto chart shows the top 30 vendors**, and the breakdown chart the top 15 groups (the table shows all).
- Export always uses commas and UTF-8 with a BOM.
- Year over year treats a blank prior-year figure as new spend, which may be wrong for incomplete data. It's stated on the page.

---

## 10. Suggested backlog (highest value first)

1. **Saved views and shareable state:** put filters, group/split and tab state in the URL hash. Add "Save view" (named, stored in `localStorage`) to a "Views" group in the side panel.
2. **Excel (.xlsx) import** without libraries.
3. **Column chooser and grouping on Line items** (show/hide and reorder columns, group rows by a column with subtotals), plus a sticky first column.
4. **Budget vs actuals:** allow a second CSV of actuals by month, and add a Variance page showing actual vs phased budget and forecast to year end.
5. **Licence utilisation:** an optional `licences used` column, showing cost of unused seats and price per active user on Vendors.
6. **Contract actions on Renewals:** "Give notice / Renew / Renegotiate" status per line, kept in `localStorage`, with CSV export of the action list.
7. **Print / PDF executive pack:** a print stylesheet producing a two-page summary (Overview + top renewals).
8. **Performance:** cache aggregates per filter state; virtualise the Line items table for 50k rows.
9. **Accessibility:** focus trap in the drawer; text alternatives (a data table) for each SVG chart; a high-contrast check.
10. **Multi-currency** with an FX rate table and a stated rate date.
11. **User-chosen colour column** and per-category colour overrides.
12. **Localisation:** number and date display locale is fixed to `en-GB`; make it a setting.

Before starting large items (1, 2, 4), propose the approach to the owner in a few sentences and wait for agreement.

---

## 11. Working agreement for your changes

- Deliver the **complete updated `budget-explorer.html`**. Keep it one file and keep the section order and naming style.
- Make small, reviewable changes, and list them in a short changelog in your reply: what changed, why, and how you verified it.
- Re-run the checklist in section 8 and report the results honestly, including anything you couldn't test.
- Don't add real company data, real people's names or credentials to the file. Sample data stays fictional.
- When something is ambiguous about the owner's process, such as fiscal year, currency or who the audience is, ask rather than guess.
- If you change the column-detection rules, re-verify all three test CSVs, since detection regressions are the easiest bug to introduce.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| Cost pool | What was bought (software, outside services, cloud, telecom, hardware…), from the TBM (Technology Business Management) taxonomy |
| Tower | Technical function (end user, application, infrastructure, network, security, data). It's a regular column here, groupable if present. |
| Notice deadline | Last day to cancel or renegotiate before a contract auto-renews |
| Bridge / waterfall | Chart showing how the prior-year total becomes this year's total |
| Pareto | Ranked bar chart with a cumulative-share line, used to show vendor concentration |
| Phasing | How the annual amount is spread across months (cash timing) |
| CAPEX / OPEX | Capital vs operating expenditure |
