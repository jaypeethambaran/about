# Visualisation design principles

These are the practices this prototype follows, where each comes from, and where it shows up in the code. They came from looking at APM/observability dashboards (Datadog), IT financial management (TBM), cloud cost reporting (FinOps/FOCUS) and SaaS/licence management tools. Most sources are vendor blogs, so treat them as practitioner guidance, not standards.

## 1. From APM/observability dashboards (Datadog)

| Practice | In this prototype |
|---|---|
| Few, large widgets; avoid many small tiles | 5 headline tiles; each section holds 1–4 cards |
| Group related content into sections that can be collapsed | `<details>` sections: Where the money goes, Renewals, Phasing, Prior year, Line items, Data quality (collapsed by default) |
| Most important information top-left; read left→right, top→bottom | Total budget first, then change, mix, urgent renewals, ownership gaps |
| Tell a story from summary → detail, with one-click drill-down | Every bar and timeline dot sets a filter; the line-item table shows the result |
| Template variables let one dashboard serve many scopes | Global filter bar (category, cost pool, tower, cost centre, vendor, owner, search), stored in the URL hash for bookmarking |
| Good tagging/naming comes before good layout | Strict spreadsheet contract plus validation (`docs/data-schema.md`) |

## 2. From TBM (Technology Business Management)

- Separate **what was bought** (cost pools: software, cloud, outside services, telecom, hardware…) from **what it's for** (towers: end user, application, infrastructure, network, security, data). Mapping one to the other is a separate exercise.
- Start at aggregate level and add detail later. Here `cost_pool` is required and `tower` is optional.
- The TBM Council has renamed "towers" in Taxonomy v5 (sources disagree on the new label). This prototype keeps the familiar word "tower"; check the current taxonomy before standardising company-wide.

## 3. From FinOps / FOCUS cost reporting

| Practice | In this prototype |
|---|---|
| State the cost basis next to the figures | Subtitle: "Annual budget in EUR, as entered… no VAT, FX or inflation adjustments" |
| Show freshness and lineage | Footer: source file, sha256, build time, line count, warning count; *as of* date in the header |
| Measure allocation quality | "Budget with no owner" tile; Data quality coverage bars |
| Keep variance and trend separate; one metric per decision | Prior-year change has its own tile and bridge, separate from phasing |
| Design around decisions, not every column | Renewals table lists only what needs action within 90 days |

## 4. From licence/SaaS management tools

- **Renewals drive savings:** many software contracts auto-renew with 30–90-day notice windows, so the key date is the *notice deadline*, not the renewal date. The timeline colours by notice-deadline urgency (passed / ≤30 / ≤60 / ≤90 / later).
- Show spend by vendor and how concentrated it is ("Top 10 of 20 vendors = 83% of spend").
- Quantity × unit price is checked against the budget (validation warning).
- Not yet built: licences bought vs actually used. That needs usage data the budget spreadsheet doesn't have. See the roadmap in `HANDOVER.md`.

## 5. General chart choices

- **Horizontal bars instead of pies or treemaps** for breakdowns: length is compared more accurately than angle or area, and long vendor names fit. (The earlier plan mentioned a treemap; bars won for readability.)
- **Zero-based axes** on every bar and column chart, including the waterfall. Changes look small next to totals because they *are* small; exact values are labelled.
- **One colour per category everywhere** (Licence = blue, Service = orange, Contract = green). Urgency uses a separate warm scale and is always paired with a text label or legend, never colour alone.
- **Cost increases are red, decreases green** in the bridge. This is the finance convention for a cost line.
- **Light and dark themes** from CSS custom properties, following the OS setting, with a manual toggle.
- **Accessibility:** tabular numbers, keyboard-focusable chart marks with tooltips on focus, `aria-label`s on SVGs, sortable tables with `aria-sort`, and no horizontal page scroll at 390 px width (checked by the smoke test).
- **No external requests:** no CDNs or web fonts. This is required on a locked-down company network, and it keeps budget data in the browser.

## Sources

- Datadog: [executive dashboards](https://www.datadoghq.com/blog/datadog-executive-dashboards/); community guide [datadog-design-dashboard](https://skills.sh/trogonstack/agentskills/datadog-design-dashboard)
- TBM Council: [TBM Taxonomy](https://www.tbmcouncil.org/taxonomy), [Practice Lead's Guide](https://www.tbmcouncil.org/the-tbm-practice-leads-guide-to-the-tbm-taxonomy/), [Modernizing TBM](https://tbmcouncil.org/learn-tbm/research/modernizing-tbm); [GSA TBM playbook](https://tech.gsa.gov/playbooks/tbm/)
- FinOps/FOCUS: [Microsoft on FOCUS](https://azure.microsoft.com/en-us/blog/focus-a-new-specification-for-cloud-cost-transparency/); [Cloud showback dashboard metrics](https://oneuptime.com/blog/post/2026-07-21-cloud-showback-dashboard-metrics/view)
- Licence management: [Zylo license dashboard](https://zylo.com/blog/license-dashboard), [CloudFuze on renewals](https://www.cloudfuze.com/saas-license-renewals-overspending/), [Cledara portfolio KPIs](https://www.cledara.com/blog/saas-portfolio-health-dashboard-kpis), [GetInSync ITFM](https://getinsync.ca/it-financial-management)
- GitLab: [Pages documentation](https://docs.gitlab.com/user/project/pages/)
