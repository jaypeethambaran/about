# IT Budget Explorer: handover for a Gemini agent

You are taking over a working prototype. This document explains what it is, how it is built and what it must keep doing, so you can improve it without breaking anything. Read it end to end before changing code.

**The artifact:** `budget-explorer.html`, one self-contained file of about 2,100 lines and 175 KB, holding HTML, CSS and JavaScript. Open it in a browser and it runs. There is no build step, server, package manager or internet connection involved.

---

## 1. Product context

| | |
|---|---|
| **What it is** | A browser app for next year's **corporate IT budget**. It covers **operational budgeting** (spend breakdowns, vendors, renewals, cash flow, year over year) and **key contracts**: one page per major contract, built from its invoice lines, scaled to a full year and compared with the budget. |
| **Primary goal** | Show leadership and budget owners where corporate IT money goes (by capability, vendor and Run / Grow / Transform), what renews when, and whether the largest contracts fit their budget |
| **Input** | One or more **CSV files with any column layout**. The app detects what each column means, and the user can correct it. |
| **Users** | CFO, CIO and IT finance at a fast-growing life sciences / SaaS company, plus budget owners. Everyone starts on **Overview**; budget owners want line detail. |
| **Taxonomy** | "Contract" is a procurement vehicle, not a technology category. Lines are categorised as **Hardware, Licence (software) or Service**. |
| **Phase** | **UI prototype.** The owner is getting feedback on the interface before moving it into the company's GitLab, most likely served as a static site on GitLab Pages with access control. |
| **Data sensitivity** | Real budgets and contract values are confidential. The app must never send data anywhere. |

### Feedback so far, which shapes what "better" means

1. The first single-page version was rejected as **"not enterprise class"**.
2. The owner asked for **sub-pages with a side panel** and **external best-practice references**.
3. The current version answers that with an enterprise app frame based on public design systems (section 6).
4. **The owner's focus is the UI** and **accepting any CSV**. Keep both central.
5. A previous Gemini session added an Executive benchmarks page and the Hardware / Licence / Service taxonomy. Claude integrated it with fixes (see the change log in section 13).
6. **The owner then had Executive benchmarks and the vendor Pareto chart removed**, and asked for **a page per key contract built from its invoices, adjusted to a yearly figure**. Don't bring the removed views back unless the owner asks.
7. **Overview and Vendors have no filter bar.** Overview lists the top 15 vendors; Vendors opens with a spend-by-owner pie chart and a vendor-size view, and its table shows renewal date and colour-coded owners instead of line counts and spend-type mix. The owner's own build also has **no way to load CSV files in the page** (`data-upload="off"`, section 3): its data is embedded at build time.

---

## 2. Quick start

1. Open `budget-explorer.html` in Chrome, Edge or Firefox. Opening it straight from disk (`file://`) works.
2. Select **Use sample data**. This loads a fictional 43-line budget embedded in the file, plus two fictional key contracts, and opens on **Overview**.
3. Click through every page in the left side panel. Click bars, table rows and timeline dots to open the details panel on the right.
4. Load a real CSV with **Load CSV** in the top bar, or drag files onto the window.

### Expected numbers for the sample data (use these as a regression check)

Set **Data source & columns → Urgency as of = 2026-11-07** first, because renewal urgency depends on that date.

| Check | Expected |
|---|---|
| Total budget (Overview tile) | **5,817,000** across **43** lines and **23** vendors, in EUR (from the `currency` column) |
| Change vs prior year | **+11.6%** (prior-year total **5,214,500**) |
| Year-over-year bridge | 5,214,500 + **680,000 new (6 lines)** + 493,500 increases − 208,000 decreases − 63,000 removed (2 lines) = 5,817,000 |
| Category split | Service 2,962,000 · Licence 2,365,000 · Hardware 490,000 (no "Contract" category) |
| Run / Grow / Transform | Run 3,771,000 (**64.8%**) · Grow 1,746,000 (**30.0%**) · Transform 300,000 (**5.2%**) |
| Business capabilities | Enterprise IT 80.6% · ERP & Supply Chain 11.6% · Commercial 5.0% · G&A 2.8% |
| Vendors page | 23 vendors; top 5 = **49%** of spend, top 10 = **75%**; no vendor under €25k, so the long-tail cut moves to €50k: **3 vendors**; pie by budget owner, largest Head of Workplace (24%); by capability, 4 slices with Enterprise IT largest |
| Key contract: Contoso Cloud | Monthly invoice 56,500 × 12 = **678,000** a year; budget (2 lines) **758,000**; headroom **80,000**; no exchange rate needed |
| Key contract: Fabrikam Security | Endpoint licences 176,400 billed yearly (×1) + SOC and retainer 72,500 a quarter (×4) = **466,400 USD**; at the file's illustrative rate 0.89 = **415,096 EUR**; budget (3 lines) **441,000**; headroom **25,904**; contract ends **30 Sep 2029**; contract years 400,000 / 466,400 / 532,800 invoiced, next **466,400 on 1 Oct 2027**; next key date: endpoint-count window opens **3 Jul 2027**. An ended onboarding invoice (12,000 for 6 months) is listed but not counted. Typing rate 0.95 gives **2,080 over budget** |
| Notice deadlines within 90 days | **18**, of which **7 overdue** |
| Data quality | 97% score, 0 errors, **5 warnings** (3 no owner, 1 no cost centre, 1 renewal date passed) |
| Monthly columns detected | 12 (Jan…Dec) |

### Other test files (in the source repo; recreate them if you don't have them)

Repo: `jaypeethambaran/about`, branch `claude/cloud-environment-setup-6a26xz`, folder `projects/it-budget-dashboard/data/`.

- **`sample-budget-explorer.csv`:** exactly the embedded sample (43 lines, with `business_capability` and `spend_category` columns).
- **`sample-budget.csv`:** the original 41-line sample (old Licence / Service / Contract taxonomy, no strategy columns; total 5,517,000). The tests still use it for column-remapping checks. Snake_case headers (`line_id, vendor, product_or_service, category, cost_pool, tower, cost_centre, owner, annual_budget, currency, capex_opex, contract_start, contract_end, renewal_date, auto_renew, notice_period_days, billing_frequency, licence_qty, unit_price, prior_year_budget, jan … dec, notes`).
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
  Expected: total 5,517,000 over 39 rows and currency USD. It opens on Overview. Renewals, Cash flow, Year over year and Cost centres show an explanation page instead of charts. On the contract pages, Contoso (EUR invoice, USD budget, no USD rate in the file) asks for an exchange rate instead of guessing, and Fabrikam (USD invoice) shows a run-rate **25,400 over** the 441,000 budget.
- **`examples/utf8-names.csv`:** non-ASCII names (Zürich, Genève, Malmö) and `€` amounts. They must display exactly as written; total 6,000.
- **`examples/pivot-export-macroman.csv`:** a fictional **Excel pivot-table export saved on a Mac**, the shape real finance exports come in:
  - Mac Roman encoding.
  - A `Reporting Category,Licences` title row above the header.
  - The vendor written only on the first row of each group.
  - `<Vendor> Total` subtotal rows and a `Grand Total` row.
  - `-` for zero.
  - A `1000 - Dummy` placeholder vendor and "CHECK WITH" / "NEED TO UPDATE" notes.

  Expected:
  - 10 line rows totalling **159,169**, with subtotals removed and vendors filled down.
  - Encoding "Mac Roman", and `Sàrl` / `Zürich` intact.
  - A "Reporting Category" column.
  - Data source reports that the lines add up to the grand total.
  - Checks: 4 placeholder-vendor lines, 2 open questions, 1 zero amount.

---

## 3. Hard constraints (do not break these)

1. **One file, no dependencies.** No CDNs, npm packages, chart libraries, web fonts, analytics or `fetch()` to any URL. The company network may block them, and the data is confidential. Draw charts with hand-built SVG or HTML, as the existing code does.
2. **Works from `file://`.** Don't rely on a server, service workers or ES module imports from other files.
3. **Data never leaves the browser.** `localStorage` holds only UI preferences, column mappings and exchange rates typed on contract pages (prefix `itbx2:`, rates as `fx:EUR:USD`), never row or invoice data.
4. **Any CSV must still load.** Column detection must stay heuristic and forgiving, and the user must always be able to override it on **Data source & columns**.
5. **Light and dark themes** must both stay correct. All colours come from CSS custom properties on `:root`.
6. **Phone width (390 px): no horizontal page scroll.** Wide tables and charts scroll inside their own container.
7. **Accessibility:**
   - Keyboard reachable rows and chart marks (`tabindex="0"`, Enter to open).
   - `aria-current="page"` on the active nav item.
   - `aria-sort` on sortable headers.
   - The drawer has `role="dialog"`, and Esc closes it.
   - Colour is never the only signal; urgency tags carry text.
8. **Numbers are shown as entered.** There is no VAT, FX or inflation adjustment, and the footer says so. The one exception is a key-contract page, which converts the invoice currency to the budget currency at a rate it states on the page (see 10).
9. **Keep the embedded sample.** The block `<script type="text/plain" id="sample-csv">…</script>` holds the fictional sample CSV, and `<script type="application/json" id="contracts-json">…</script>` holds two fictional key contracts that go with it. Don't reformat or remove them. All vendor names in them are fictional.
10. **Key-contract figures must show how they were derived.**
    - The yearly figure is always *amount × 12 ÷ months in the line's service period*, and the page says so.
    - An exchange rate from the file is labelled "assumed" and the user can replace it. With no rate, show "—" and ask for one; never guess.
    - Never invent invoice lines. A contract without an invoice shows an empty state that says what to add.
11. **Write invisible characters as escapes.** A previous round of edits silently turned `'\ufffd'` into `''`, which broke UTF-8 detection for every file. Use `\ufffd`, `\u00a0` and `\u241f` in source, never the literal characters.
12. **Sample data stays fictional, including vendor names.** Don't use real companies (a previous round added three; they were renamed).
13. **Real company data never goes into the repo or a shared file.**
    - Builds with real data embedded are made in `projects/it-budget-dashboard/data/private/`, which is git-ignored, and handed to the owner directly.
    - Never paste real figures into this document, test files or the committed HTML.
    - Get the owner's approval before sending real data to any external service, including other AI tools.
14. **Curated builds can switch off CSV loading.** `data-upload="off"` on `script#sample-csv` hides **Load CSV**, drag and drop, the landing page's **Choose CSV files** and the Data source **Replace…** / **Sample data** buttons (`UPLOAD` in the script). The committed template keeps loading on, so it can be tested with the example files.
15. **Keep `window.BudgetExplorer`.** It is the hook used by automated tests: `{ S, parseCSV, parseNum, parseDate, guessMapping, computeBridge, loadSample, go, CONTRACTS, contractData, periodMonths, UPLOAD }`.

---

## 4. Architecture

### File layout (top to bottom)

| Part | What it contains |
|---|---|
| `<style>` | Design tokens on `:root`, dark overrides (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`), then components: shell, nav, page header, buttons, tags, filter bar, cards, KPI tiles, bars, charts, data table, calendar, drawer, empty states, forms |
| `<body>` | App frame: `.topbar`, `nav#sidenav`, `main#main`, plus `#drawer`, `#scrim`, `#tooltip`, `#toast` and the hidden `input#file-input` |
| `script#sample-csv` | The embedded fictional sample CSV (plain text) |
| `script#contracts-json` | Key contracts and their invoice lines (JSON; fictional in the committed file, schema in section 7) |
| `<script>` | One IIFE in eight numbered sections, shown below |

### Script sections

1. **Helpers:** `h()` and `s()` build HTML and SVG elements (`h(tag, attrs, ...children)`; attributes starting with `on` become event listeners). Also `icon()` (inline SVG paths in `ICONS`), formatters (`fmtMoney`, `fmtC` compact, `fmtPct`, `fmtSignedPct`, `fmtDay`), `niceTicks`, the tooltip (`withTip`) and `toast`.
2. **CSV:**
   - `decodeBytes(buf)` uses UTF-8 when valid. Otherwise it picks Windows-1252 or Mac Roman (Excel on Windows / Mac), whichever produces more common accented letters and punctuation. The chosen encoding is shown on Data source.
   - `parseCSV(text)` detects the delimiter (`,` `;` tab `|`) and handles quotes and CRLF.
   - The header is the first row filled to **at least 60%** of the widest row.
     - Title rows above it are skipped.
     - "Key, Value" rows above it (e.g. `Reporting Category,Licences`) become constant columns.
   - **Pivot-table exports:**
     - Rows whose first cell ends in "Total" and whose other cells are numeric or blank are subtotals, and are removed so nothing is counted twice.
     - `Grand Total` / `Total` is kept aside for reconciliation.
     - Labels left blank under a group (in the columns that subtotals refer to) are filled down; this resets at each subtotal.
   - `combine()` merges several files by header name and adds a `Source file` column.
   - `reconcile()` compares each file's line items with its own grand total. Data source shows "Lines add up? Yes / No", and a toast reports it on load.
3. **Profiling and column detection:**
   - `profile()` classifies each column as `number`, `date` or `text`, and detects the decimal separator and date order per column.
   - `guessMapping()` assigns **roles** (below).
   - `guessCurrency()` detects the currency from the amount column, or from a `Currency` column holding one ISO code.
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
   - SVG charts: `sparkline`, `columnChart` (stacked, with an optional cumulative line), `waterfall`, `ring` and `timeline`.
7. **Pages:** one `pageX(recs)` function per page, plus `insX(recs)` for the one-line finding in each page header. `rgtClass()` maps a spend-type value to Run / Grow / Transform so those three always get `--run` / `--grow` / `--transform`.
   - **Key contracts:** `readContracts()` parses `#contracts-json` at start-up (into `CONTRACTS`, which adds one `PAGES` entry per contract); `annualise()` and `periodMonths()` scale each invoice line; `contractData(c)` returns everything a page needs (lines, matched budget lines, rate, run-rate, gap); `pageContract`, `insContract`, `invoiceDrawer`, `matchText`, `fmtIn` (money in any currency) and `fmtFactor`.
8. **Rendering, routing and loading:**
   - `render()`, `route()` and `go(id)`.
   - Applying settings: `apply()`.
   - Loading: `load()`, `readFiles()`, `loadSample()`.
   - `downloadCsv()`, used by `exportCsv()` (filtered rows) and `exportContract()` (annualised invoice lines), followed by the event wiring.

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
  ui: { ctSort, groupBy, splitBy, bdView, *Sort, lPage, lSize, density, renTab, renSeg, yoyTab, drawerReturn }
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
| `capability` | Business capability | capabilit, domain, function (cost centre is matched first, so "Function" goes there) |
| `spend_cat` | Spend type: Run / Grow / Transform | run…grow, spend category / type, transform, investment type, RGT |
| `capex` | CAPEX / OPEX | capex, opex |
| `renewal` | Renewal or end date (date column) | Tried in order: renew → expir → end date / contract end / due |
| `notice` | Notice period in days | notice |
| `auto` | Auto-renews Y/N | auto |
| `id` | Line ID | id, ref, reference, item no |

**Monthly columns** are numeric columns whose header looks like a month: `Jan`, `January 2027`, `2027-01`, `M01`, `P1`.

**Parsing rules:**
- **Numbers:** `1,234.50`, `1.234,50`, `$1,234`, `(1,234)` for negatives, `1234-`, and a lone `-` / `–` for zero (accounting format) are accepted. The decimal separator is detected per column.
- **Run / Grow / Transform columns are also found by their values:** a text column whose values are mostly Run / Grow / Transform becomes the spend type, whatever its header says. Without this, a header like "Spend type (draft)" would match the cost-pool rule.
- **Dates:** `YYYY-MM-DD`, `d/m/yyyy`, `d.m.yyyy`, `31 Mar 2027` and `Mar 31, 2027` are accepted. Day/month order is detected per column (day-first unless the data proves otherwise), and two-digit years mean 20xx.

### Definitions used across pages

- **Notice deadline** = renewal date − notice period (days). Without a notice column, it equals the renewal date.
- **Urgency bands**, as days from "as of" to the deadline: overdue (< 0), ≤ 30, 31–60, 61–90, > 90.
- **Year-over-year bridge:**
  - prior year + new (no prior figure) + increases − decreases − removed (amount 0 with a prior figure) = this budget.
  - It must always reconcile exactly.
- **Data-quality score** = share of |spend| in rows with no *error* or *warning* flags. Info flags don't count. The checks are in `CHECKS` as `[key, label, severity]`, including:
  - **placeholder vendor:** "Dummy", TBD, TBC, unknown, various, n/a (warning)
  - **open question in the text:** "need to update", "check with", "to be confirmed", TBC, "unclear", "duplicate", or a cell ending in "?" (warning)
  - **unclassified value:** "Unknown", TBD, n/a, "Varied" in a classification column such as capability, category or owner (warning)
  - **zero amount** (info)
- **Monthly phasing:** rows with month columns use them. Rows without them are spread evenly over 12 months, and the share of spend this affects is always stated.
- **Fiscal year start** (`opts.fyStart`) reorders months on Cash flow and the Overview chart, and defines Q1–Q4.
- **New spend:** a blank **or zero** prior-year figure counts as new in the bridge, the Year over year tabs and the vendor table.
- **Run / Grow / Transform classification** (`rgtClass`), applied to the spend-type value, case-insensitive, for colours:
  - *transform*, *innovat*, *change the business*, *CTB* → Transform
  - *grow*, *expan*, *scale* → Grow
  - *run*, *operat*, *maint*, *sustain*, *keep the lights on*, *KTLO*, *RTB* → Run
  - anything else, including blank → grey (`--other`)
- **Key contracts:**
  - **Months billed** = days in the service period (both dates included) ÷ 30.44, rounded to a whole number when within 10% of one: 17 Aug–16 Sep and 1–31 Aug are 1 month, a calendar quarter is 3, a year is 12. A 14-day period stays 0.46.
  - **Per year** = invoiced amount × 12 ÷ months billed (×12, ×4, ×1). It assumes today's quantities and prices for a whole year, and excludes VAT.
  - **Budget** = rows whose vendor matches the contract's `match` regex (the whole row when no vendor column is mapped). Rows matching `related` are listed but not counted.
  - **Exchange rate** (when invoice and budget currencies differ): the user's rate from `localStorage`, else `fx.rate` from the file when `fx.to` is the budget currency, else none. With no budget currency set, amounts are compared as they are.
  - **Headroom** = budget − run-rate in budget currency. Negative is shown as "Run-rate over budget" with a red KPI accent.
  - **Invoice check:** the lines must add up to `total − vat` when the invoice gives a total.
  - **Ended invoices** (`"status": "ended"` on an invoice or a line) are listed last, greyed, and left out of the run-rate; the page states what they would add a year if renewed. Status is set in the data, not from dates, because a monthly invoice from a past month still stands for a recurring charge.
  - **Current term ends** = the latest end date among current lines billed for 6 months or more, with days left from "as of" (orange within 90 days). Monthly and quarterly contracts don't show it. When the contract has `term`, the tile says **Contract ends** and uses `term.to`; the Vendors renewal date is the day after.
  - **Replaced orders** (`"status": "superseded"`) are listed and greyed like ended ones, but without an "if renewed" value.
  - **Contract years** (`schedule`): one row per year with the yearly fee and, when it differs, what is invoiced (back-loaded payment plans). The title names the next invoice and how far it is from the yearly fee; the subtitle gives what is still to be invoiced after "as of".
  - **Key dates** (`dates`): single dates or windows (`from` … `date`), with status Passed / Open (days left) / In N days; the next one is also a KPI tile. Six tiles show as two rows of three.
  - **`warning`** shows a yellow banner at the top of the page (for example, a figure taken from a draft).

---

## 5. Pages (the `PAGES` registry)

Each entry is `{ id, label, icon, group, render, insight, needs?, needsText?, noFilters?, title?, contract? }`. A page whose `needs()` is false is greyed in the nav. Its page explains which column is missing and links to the mapping form.

| Group | Page | Shows | Needs |
|---|---|---|---|
| Analyse | **Overview** | **The landing page. No filter bar: it always shows the whole budget.** When no column is small enough to colour by (8 values or fewer), the first card is spend by capability (else cost centre or owner). KPI tiles (total with trend line and change vs prior year, vendors, 90-day deadlines, new spend, quality score), then cards for category mix (a bar opens Line items filtered to it), the **top 15 vendors** (a bar opens the vendor panel), the first deadlines to act on, monthly cash flow, a mini bridge and data checks. Each card links to its page. | amount |
| Analyse | **Spend breakdown** | **Group by** any column, **Split by** another, and a **View** switch (Chart / Table / Chart + table). Stacked bars plus a cross-table with shaded cells. Clicking filters. | amount |
| Analyse | **Vendors** | **No filter bar.** KPI tiles: vendors with spend, top-10 share, vendors in the long tail (under 25k, moving to 50k / 100k when fewer than 3 vendors are that small; thresholds scale with the budget size), renewals in the next 90 days. A **pie (donut) chart by budget owner**, switchable to capability or cost centre, with its key as a table and a note on vendors bought by more than one owner; a **vendor-size card** (vendors and spend per spend band). Then the vendor table: rank, spend, share, change vs prior, **renewal date** (the file's renewal column, else the day after a key contract's current term) and **owner as a coloured chip** (same colours as the pie). Without an owner column the chips show the capability (else cost centre) column, under that column's name. Slices, bands and rows open panels. The Pareto chart, Lines and Mix columns were removed at the owner's request. | vendor |
| Analyse | **Cost centres & owners** | Shaded grid of cost centre × colour column, and an owner table with lines lacking an owner highlighted | cost centre or owner |
| Key contracts | **One page per contract** in `#contracts-json` (id `c-<id>`) | KPI tiles: annual cost at current run-rate, budget, run-rate in budget currency (when currencies differ), headroom or over budget, and current term end (yearly or half-yearly contracts). Cards: annual cost by product (coloured by `kind`, click for line details); budget vs run-rate bars with the exchange-rate input and the matched and related budget lines; the invoice lines table (quantity, service period, invoiced, factor, per year, per unit per month, share) with an invoice-total check; and how the figures are calculated. Export CSV gives the annualised lines. No filter bar. | invoice lines in `#contracts-json` |
| Plan | **Renewals** | Urgency filter buttons, then **Timeline / Calendar / List** tabs. The calendar has 12 month cards grouped by notice-deadline month, plus Overdue and Later cards. | renewal date |
| Plan | **Cash flow** | Monthly stacked columns with a cumulative-% line, and a quarterly summary table | ≥ 2 month columns |
| Plan | **Year over year** | Waterfall bridge, then Increases / Decreases / New / Removed tabs | prior-year amount |
| Data | **Line items** | Every original column, sortable, 25/50/100/250 rows per page, compact or comfortable rows, totals footer. A row opens the **line details panel**. | amount |
| Data | **Data quality** | Score ring, checks by severity and "View rows" (filters Line items to that check) | amount |
| Data | **Data source & columns** | Loaded files, settings (label, currency, number format, date format, as-of date, fiscal-year start) and the column mapping form. Apply / Re-detect. | (always) |

**Global filter bar**, which appears on every page except Overview, Vendors, Data source and the contract pages. Those pages always use every row; clicking a bar there that would filter opens Line items with the filter instead (`setFilter`).
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
| Data colours | `--bar` (single series), `--other`, `--c1…--c14` (categories; IBM Carbon's 14-colour order, the last six used when a column has more than 8 values, such as owners), `--up` / `--down` (cost increase red, decrease green), `--run` / `--grow` / `--transform` with `--rgt-ink` for labels on them |
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
1. Add an entry to `PAGES`, for example `{ id:'notices', label:'Notices', icon:'calendar', group:'Plan', render:pageNotices, insight:insNotices, needs:() => S.map.renewal != null, needsText:'a renewal date column' }`.
2. Write `function pageNotices(recs)` returning a node or an array of nodes. Build with `card()`, `dataTable()`, `hbarList()` and so on.
3. Write `function insNotices(recs)` returning one sentence that states the finding.

Use function declarations, not `const` arrow functions, because `PAGES` references them before they're defined.

**Add or update a key contract.** No code change is needed: edit the JSON in `#contracts-json`.
```json
{ "contracts": [
  { "id": "contoso", "name": "Contoso Cloud", "nav": "Contoso", "match": "^contoso cloud$", "related": "contoso",
    "currency": "EUR", "fx": { "to": "USD", "rate": 1.10, "note": "Where the rate comes from" },
    "notes": ["Shown under How these figures are calculated"],
    "invoices": [ { "ref": "INV-001", "from": "2026-10-01", "to": "2026-10-31", "vat": 0, "vatLabel": "reverse charge", "total": 56500.00,
      "lines": [ { "product": "Reserved compute capacity", "qty": 120, "unit": "vCPU", "kind": "Compute", "amount": 26400.00,
                   "from": "2026-10-01", "to": "2026-10-31", "note": "optional" } ] } ] } ] }
```
- An invoice can have `short` (a short label for the Invoice column), `status: "ended"` or `"superseded"` and `statusNote`.
- A contract can also have `term: { from, to }`, `warning`, `schedule: [ { label, from, to, fee, payment?, note? } ]` and `dates: [ { date, from?, label, note? } ]`.
- `id`, `name` and `match` are required; `nav` (shorter nav label), `related`, `currency`, `fx`, `notes` and `invoices` are optional.
- A line's `from` / `to` override the invoice's. `months` can be given instead of dates.
- A line can list what it covers in `includes` (array of text). A contract with one product shows a summary card (quantity, price per unit, included items) instead of a one-bar chart.
- `kind` groups and colours lines (for example "Full user licences", "Capacity & sandbox").
- Keep amounts as on the invoice, excluding VAT. Real invoices go only into private builds (constraint 13).

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

**Automated (in the source repo):** `projects/it-budget-dashboard/tests/explorer_test.cjs`, a Playwright script with 106 checks that opens the file from disk. Run it with `node tests/explorer_test.cjs`, or `SCREENSHOT_DIR=… node tests/explorer_test.cjs` to also save a screenshot of each page. It checks that:
- The sample opens on Overview; there is no Executive benchmarks page, and the nav groups are Analyse, Key contracts, Plan, Data.
- Every page renders and is marked current in the nav.
- Overview has no filter bar, shows 15 vendors plus "All other", and its bars open the vendor panel or Line items without leaving a hidden filter.
- Vendors has no Pareto chart and no filter bar; its table has Renewal and coloured Owner columns but no Lines or Mix; the pie has one slice per owner, opens an owner's vendors, and switches to capability; the long-tail cut and size bands add up.
- A copy with `data-upload="off"` has no Load CSV button and no Replace / Sample data buttons.
- Service periods map to 1, 1, 3, 12 and 0.46 months; both sample contracts give the figures in section 2, including the ended and replaced orders, contract end, contract years, key dates and the warning banner (as of 8 Nov 2026); typing an exchange rate updates the comparison and "Use 0.89" restores it; a bar opens the line details; Export CSV gives the annualised lines.
- No "Contract" category remains, and the bridge reconciles with 6 new lines.
- Group-by, filter chips and the view switch work.
- The vendor panel opens, a line panel opens from inside it, and Esc closes the panel.
- The renewal urgency filter and the calendar work.
- "View rows" filters Line items, and pagination works.
- UTF-8 names stay intact.
- The Mac Roman pivot export loads with subtotals removed, vendors filled down, the title row kept as a column, reconciliation "Yes" and the expected checks.
- The EU and minimal CSVs load with the expected column detection, and on the minimal file the contract pages ask for a rate or show the over-budget case.
- Remapping the amount column changes the total, and re-detect restores it.
- There's no horizontal scroll at 390 px, and the phone menu opens.
- There are no console errors.

If you can't run it, do the manual checklist below after every change.

**Manual checklist:**
1. Sample data loads on Overview. Check every number in section 2, including both Key contracts pages.
2. Visit every nav item, and check the browser console shows no errors.
3. Clicking a vendor bar adds a filter chip, and all pages respect it. **Clear filters** resets them.
4. A Vendors row opens the panel. Clicking a line inside opens line details. Esc closes the panel, and focus returns to where it was.
5. Renewals: each urgency segment and each tab (Timeline, Calendar, List) shows matching counts.
6. Data source: changing the amount column to `prior_year_budget` and selecting **Apply** gives total 5,214,500. **Re-detect columns** followed by **Apply** restores it.
7. Load the EU, minimal, UTF-8 and pivot-export CSVs; check against section 2.
8. On Fabrikam Security, type an exchange rate, check the KPIs update, then select **Use 0.89**.
9. Toggle dark mode with the moon icon; check the 390 px phone width.

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
- **One budget currency.** There's no warning when a budget file mixes currencies. Only contract pages convert, with one rate per currency pair, saved per browser.
- **"As of" defaults to today and isn't saved**, so overdue counts change day by day.
- **The breakdown chart shows the top 15 groups** (the table shows all).
- Export always uses commas and UTF-8 with a BOM.
- Year over year treats a blank or zero prior-year figure as new spend, which may be wrong for incomplete data. It's stated on the page.
- **Key contracts:**
  - Invoice lines are typed into the JSON block; there's no in-app import yet.
  - The run-rate is one invoice scaled up. It ignores seat changes, price rises and one-off charges during the year.
  - Budget lines are found by a vendor-name pattern, so a renamed vendor in the budget file needs `match` updated.

---

## 10. Suggested backlog (highest value first)

1. **Invoice import on contract pages:** load or paste invoice lines as CSV (product, quantity, period, amount), saved per browser, so new invoices don't need a file edit.
2. **Saved views and shareable state:** put filters, group/split and tab state in the URL hash. Add "Save view" (named, stored in `localStorage`) to a "Views" group in the side panel.
3. **Excel (.xlsx) import** without libraries.
4. **Column chooser and grouping on Line items** (show/hide and reorder columns, group rows by a column with subtotals), plus a sticky first column.
5. **Budget vs actuals:** allow a second CSV of actuals by month, and add a Variance page showing actual vs phased budget and forecast to year end.
6. **Licence utilisation:** an optional `licences used` column, showing cost of unused seats and price per active user on Vendors.
7. **Contract actions on Renewals:** "Give notice / Renew / Renegotiate" status per line, kept in `localStorage`, with CSV export of the action list.
8. **Print / PDF executive pack:** a print stylesheet producing a two-page summary (Overview + top renewals).
9. **Performance:** cache aggregates per filter state; virtualise the Line items table for 50k rows.
10. **Accessibility:** focus trap in the drawer; text alternatives (a data table) for each SVG chart; a high-contrast check.
11. **Multi-currency budgets** with an FX rate table and a stated rate date (contract pages already convert one invoice currency).
12. **User-chosen colour column** and per-category colour overrides.
13. **Localisation:** number and date display locale is fixed to `en-GB`; make it a setting.

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
| Run-rate | What a contract costs per year if the latest invoice repeats unchanged |
| Phasing | How the annual amount is spread across months (cash timing) |
| CAPEX / OPEX | Capital vs operating expenditure |

---

## 13. Change log

**Departments from the owner's own column (8 Nov 2026), done by Claude, at the owner's request:**
- The owner's build now embeds only the owner's cleaned sheet. Columns joined from an older finance export had shown a different "budget owner" for 38 of 98 tools; rule: never add columns to the owner's data that the owner didn't provide.
- Vendors and Overview use the capability column as the department when there is no owner column. One-product contracts get a summary card with `includes`. A third fictional contract (Proseware HR) covers it; 106 checks.

**Multi-year contracts (8 Nov 2026), done by Claude, at the owner's request (pages for two more contracts in the owner's build):**
- Contract pages read order forms as well as invoices: contract term, contract years with yearly fee vs invoiced amount, key dates (deadlines and reporting windows) with a Next key date tile, replaced orders, and a warning banner.
- Fictional sample extended to cover each of these; 100 checks.

**Vendors page redesign (8 Nov 2026), done by Claude, at the owner's request:**
- No filter bar. The table drops Lines and Mix by spend type, and adds the renewal date and the owner as a coloured chip.
- New insights at the top: KPI tiles (vendors, top-10 share, long tail, renewals in 90 days), a pie chart of spend by budget owner (or capability / cost centre) with a shared-vendor note, and a vendor-size card.
- Palette extended to 14 categorical colours. 94 checks.

**Overview, CSV loading and ended invoices (8 Nov 2026), done by Claude, at the owner's request:**
- Overview has no filter bar and always shows the whole budget; top vendors went from 8 to 15. Bars open the vendor panel or Line items instead of applying a filter you can't see.
- `data-upload="off"` removes every way to load CSV files in the page, for curated builds. The owner's build uses it.
- Contract pages: invoices can be marked ended (listed, not counted, with their yearly value if renewed); yearly contracts show when the current term ends; tighter invoice table.
- 85 checks in `explorer_test.cjs`.

**Key contracts; benchmarks and Pareto removed (8 Nov 2026), done by Claude, at the owner's request:**
- Removed the Executive benchmarks page with its company figures, targets, CSS and landing card. Overview is now the landing page for every file.
- Removed the Pareto chart from Vendors; the insight now gives the top-5 and top-10 shares.
- Added **Key contracts**: a nav group with one page per contract in `#contracts-json`. Invoice lines are scaled to a year from their service period, compared with the matching budget lines, converted at a stated exchange rate when currencies differ, and exported as CSV.
- The committed file has two fictional contracts. The owner's private build has real invoices, which are not in the repo.
- `guessCurrency()` also reads a `Currency` column, so the sample now shows EUR.
- 74 checks in `explorer_test.cjs`.

**Ready for real finance exports (8 Nov 2026), done by Claude.** Tested against the owner's real licence-spend export, which isn't in the repo, and reproduced with the fictional `pivot-export-macroman.csv`:
- Mac Roman / Windows-1252 detection.
- Header detection at 60% width, with "Key, Value" title rows turned into columns.
- Pivot subtotal removal with label fill-down, and grand-total reconciliation on Data source.
- `-` as zero.
- Run / Grow / Transform column detection by value.
- Placeholder-vendor, open-question and zero-amount checks.
- Pages that aren't available say what they need in the subtitle.
- **Embedded data:** `<script type="text/plain" id="sample-csv" data-name="…" data-label="…" data-button="…" data-autoload="true">` lets a private build open straight onto its own data.
- Remaining invisible characters in the script (BOM, NBSP) were converted to escapes.

**Integration of the Gemini rework (8 Nov 2026), done by Claude.** Kept from Gemini:
- The Executive benchmarks page.
- The `capability` and `spend_cat` column roles.
- The Hardware / Licence / Service taxonomy and benchmark-first landing.
- The extra sample columns and Transform lines.

Fixed:
- **UTF-8 detection was broken for every file.** `text.includes('')` was always true, so `€` and `ü` turned into mojibake. It's now `'\ufffd'`.
- **Real vendor names in the sample** (three) were replaced with fictional ones.
- **Invented company figures:** revenue 150,000,000 and 800 FTE were used whenever the user entered nothing. Inputs now start blank.
- **Targets attributed to "Gartner / TBM" without a source** are now editable assumptions with a clear caveat.
  - Public data points to an older Gartner-based split of about 70 / 20 / 10, and Gartner now advises balance over fixed ratios.
  - Revenue and per-FTE ratios live in paywalled Gartner and Avasant studies.
- **Like-for-like comparison:** benchmarks compare total IT spend, but the file holds only external spend, so "other IT spend not in this file" was added.
- **Unclassified spend** was being counted as Run. It's now shown separately.
- **Changing revenue reset all filters** (it called `apply()`), and the inputs had no ids, so focus was lost. It now re-renders after focus moves, and inputs have stable ids.
- **The Executive benchmarks page opened for every file.** It now opens only when the file has a spend-type or capability column.
- **A blank or zero prior-year figure** is now new spend in the bridge. The two Transform lines were wrongly counted as increases.
- **The `.stack-seg` CSS class was reused**, changing the Spend breakdown chart. The class was renamed to `.rgt-*`.
- **The "Cash flow & year over year" feature card**, accidentally removed from the landing page, was restored.
- Revenue and headcount moved off the Data source settings so there's one place to enter them.
- New tests cover benchmarks, UTF-8 and the bridge (57 checks).
