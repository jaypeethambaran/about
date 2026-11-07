# Moving to company GitLab

**Status: not done yet and untested.** The draft pipeline in [`gitlab-ci.example.yml`](gitlab-ci.example.yml) has never run on a GitLab instance. Treat it as a starting point and verify each step on the company instance.

## Steps

1. **Create a private project** in the company GitLab group (for example `it-budget-dashboard`) and copy this whole folder into its root, so that `site/`, `scripts/` and so on sit at the top level.
2. **Enable Pages access control before the first deploy.** On GitLab.com, Pages sites are public by default. Go to *Settings → General → Visibility → Pages* and set it to "Only project members". On self-managed GitLab, an administrator must have Pages and Pages access control enabled. Confirm this with the GitLab admins.
3. **Activate the pipeline:** `cp docs/gitlab-ci.example.yml .gitlab-ci.yml`. Check the `image:` names against what the company runners can pull. Many internal networks mirror Docker Hub, so the image names may need a registry prefix.
4. **Decide where the real spreadsheet lives** (see below), and point `BUDGET_FILE` in `.gitlab-ci.yml` at it.
5. **Protect `main`** and require merge-request approval from a budget owner (Finance or IT). A budget update then becomes: open an MR that replaces the spreadsheet → the pipeline validates it → a reviewer checks the validation report artifact → merge → Pages publishes.
6. Run the pipeline and open the Pages URL that GitLab shows under *Deploy → Pages*. Check that a colleague without project access gets a login prompt, not the dashboard.

## Where to keep the real spreadsheet

| Option | Pros | Cons |
|---|---|---|
| **A. Commit it to the private project** (recommended to start) | Simple. Every change is reviewed and versioned. | Anyone with repo access sees all figures. Needs care with history if a mistake is committed. |
| B. Store it as a CI/CD *file variable* (protected and masked) | Kept out of git history | No review diff. File-variable size limits. Less transparent. |
| C. Fetch it from SharePoint or a file share in CI | Single source of truth stays with Finance | Needs service credentials and network access from the runners. More moving parts. |

## Pipeline outline (in the example file)

| Stage | Job | What it does |
|---|---|---|
| `test` | `unit-tests` | `python3 -m unittest discover -s tests` |
| `build` | `build-data` | `build_data.py $BUDGET_FILE`. Fails the pipeline on data errors. Keeps `reports/validation-report.md` as an artifact (also on failure). |
| `deploy` | `pages` | Copies `site/` to `public/` and publishes on the default branch only |

The browser smoke test (`tests/smoke_test.cjs`) isn't in the pipeline, because it needs a Playwright image. Add it with `mcr.microsoft.com/playwright` if your registry mirrors it.

## Gotchas

- **Per-owner visibility:** Pages access control is all-or-nothing per project. If budget owners must see *only their own lines*, a static site can't enforce it, because the filters are cosmetic and all the data is in `data.js`. That would need either one Pages project per audience (built from filtered spreadsheets) or a server-side app.
- **`--as-of`:** in CI, renewal urgency is calculated at build time. Rebuild regularly (for example, a weekly scheduled pipeline) so "days left" doesn't go stale, or move that calculation to the browser (one line in `app.js`: use `new Date()` instead of `META.as_of`).
- Pages URLs and settings menu paths differ between GitLab versions. Follow the docs for the company's version.
