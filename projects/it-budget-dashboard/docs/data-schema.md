# Spreadsheet data contract

One row per budget line. Sheet name `Budget` (otherwise the first sheet is used, or pass `--sheet`). The first non-empty row is the header. `.xlsx` and `.csv` (comma, semicolon or tab separated, UTF-8) are supported. For `.xls`, save it as `.xlsx` first.

Headers are matched case-insensitively, with spaces and punctuation treated as `_`. For example, `Cost Centre` matches `cost_centre` and `January` matches `jan`. A few aliases are accepted: `product`, `description` → `product_or_service`; `budget` → `annual_budget`; `cost_center` → `cost_centre`; `id` → `line_id`. Unknown columns are ignored and a warning is raised.

## Columns

| Column | Status | Type | Rules / meaning |
|---|---|---|---|
| `line_id` | **Required** | text | Unique per row. Duplicate → error. |
| `vendor` | **Required** | text | Supplier, spelled consistently (it's a filter and a grouping key). |
| `product_or_service` | **Required** | text | What is bought. |
| `category` | **Required** | `Licence` \| `Service` \| `Contract` | Plurals and US spelling are accepted. Anything else → error. |
| `cost_pool` | **Required** | text | What was bought, TBM-style. Suggested values: Software, Cloud services, Outside services, Telecom, Hardware, Hardware maintenance. |
| `annual_budget` | **Required** | number ≥ 0 | Budget-year amount in the reporting currency, excl. VAT. **Use 0 for lines being cancelled** (they appear as *Removed* in the prior-year bridge). |
| `currency` | **Required** | ISO code | One currency per file; mixed → error. |
| `owner` | Recommended | text | Accountable person or role. Blank → warning, counted as "no owner". |
| `cost_centre` | Recommended | text | Finance cost centre. Blank → warning, shown as "(unassigned)". |
| `tower` | Optional | text | Technical function: End user, Application, Infrastructure, Network, Security, Data. |
| `capex_opex` | Optional | `CAPEX` \| `OPEX` | Other values → warning. |
| `contract_start`, `contract_end` | Optional | date | End before start → warning. |
| `renewal_date` | Optional | date | Drives the renewals timeline. In the past (with budget > 0) → warning. |
| `auto_renew` | Optional | Y/N | Also accepts Yes/No/True/False/1/0. |
| `notice_period_days` | Optional | integer | **Notice deadline = renewal_date − notice_period_days.** Auto-renew with no notice period → warning. |
| `billing_frequency` | Optional | text | Monthly, Quarterly, Annual, One-off (informational). |
| `licence_qty`, `unit_price` | Optional | number | If both are set, qty × price must be within 2% of `annual_budget`, otherwise → warning. |
| `prior_year_budget` | Optional | number | Current year's budget for comparison. **Blank = new spend** in the bridge. |
| `jan` … `dec` | Optional | number | Monthly cash phasing. If any month is filled, blanks count as 0, and a sum that differs from `annual_budget` by more than 0.5% → warning. If all are blank, the line is spread evenly over 12 months and flagged as *derived*. |
| `notes` | Optional | text | Shown as a hover tooltip on the line row and searchable. |

**Dates:** use real Excel dates or `YYYY-MM-DD` text. `31/03/2027`-style text is rejected on purpose, because day/month order is ambiguous.

**Numbers:** plain numbers are preferred. `€`, `$`, `£`, `EUR`, spaces and thousands commas are stripped, and `(123)` is read as −123. European decimal commas (`1.234,56`) are **not** supported. Use a real number cell instead.

## Command-line options

```
python3 scripts/build_data.py INPUT [--sheet NAME] [--as-of YYYY-MM-DD] [--year YYYY] [--out PATH] [--report PATH]
```

- `--as-of`: the reference date for "days until notice deadline" (default: today). Set it to freeze a snapshot.
- `--year`: the budget-year label (default: the year after `--as-of`).
- Exit codes: `0` built, `1` blocked by errors (data.js not written), `2` unreadable file or bad arguments.

## Output: `site/data.js`

```js
window.BUDGET_DATA = {
  meta:   { source_file, source_sha256, generated_at, as_of, budget_year, currency,
            line_count, total_budget, error_count, warning_count },
  issues: [ { level: "error"|"warning", row, line_id, field, message }, ... ],
  lines:  [ { ...all columns above (normalised)..., notice_deadline, monthly: [12 numbers],
              monthly_derived: bool, row }, ... ]
};
```

It's a `.js` file rather than `.json` so the page works when opened straight from disk: browsers block `fetch()` of local JSON on `file://`. If the app moves to a web server, switching to `data.json` + `fetch` is a small change in `app.js`.
