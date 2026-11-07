# Budget data validation report

- **Status:** ✅ Built
- **Source:** `sample-budget.xlsx` (sha256 `e2b8cef41ad9`)
- **Budget year:** 2027  ·  **As of:** 2026-11-07  ·  **Currency:** EUR
- **Lines:** 41  ·  **Total budget:** 5,517,000
- **Errors:** 0  ·  **Warnings:** 6

## Errors

None.

## Warnings

| Row | Line ID | Field | Message |
|---|---|---|---|
| 18 | IT-017 | owner | No owner. |
| 18 | IT-017 | unit_price | licence_qty × unit_price = 54,000 but annual_budget = 58,000. |
| 25 | IT-024 | owner | No owner. |
| 25 | IT-024 | cost_centre | No cost centre. |
| 32 | IT-031 | renewal_date | Renewal date 2026-09-30 has passed; update it or confirm the renewal. |
| 34 | IT-033 | owner | No owner. |
