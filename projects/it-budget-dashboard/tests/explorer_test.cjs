// Browser test for explorer/budget-explorer.html (multi-page app shell).
//   node tests/explorer_test.cjs
//   SCREENSHOT_DIR=/some/dir node tests/explorer_test.cjs   # also saves a screenshot of every page
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'explorer', 'budget-explorer.html');
const EX = (f) => path.join(ROOT, 'data', ...f.split('/'));
const shots = process.env.SCREENSHOT_DIR;
let failures = 0;
const check = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) failures++; };
const PAGES = ['overview', 'breakdown', 'vendors', 'organisation', 'c-contoso', 'c-fabrikam', 'renewals', 'cashflow', 'yoy', 'lines', 'quality', 'source'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const kpiVal = (id) => page.getAttribute(`[data-kpi="${id}"] .kpi-v`, 'data-value').then(Number);
  const total = () => kpiVal('total');
  const mapped = (key) => S((k) => { const s = window.BudgetExplorer.S; return s.map[k] == null ? null : s.headers[s.map[k]]; }, key);
  const shot = async (name, tall = true) => {
    if (!shots) return;
    if (tall) {
      const hgt = await page.evaluate(() => document.querySelector('#main').scrollHeight + 48);
      await page.setViewportSize({ width:1440, height:Math.min(Math.max(900, hgt), 5000) });
    }
    await page.screenshot({ path:path.join(shots, `ex-${name}.png`) });
    await page.setViewportSize({ width:1440, height:900 });
  };
  const nav = async (id) => { await page.click(`#nav-${id}`); await page.waitForFunction((p) => window.BudgetExplorer.S.page === p, id); };
  const loadFile = async (files, name) => {
    await page.setInputFiles('#file-input', files);
    await page.waitForFunction((n) => window.BudgetExplorer.S.files[0] === n, name);
    await page.waitForTimeout(100);
  };

  await page.goto(URL);
  console.log('Landing');
  check(await page.isVisible('#landing-sample'), 'landing shows "Use sample data"');
  check(await page.getAttribute('#nav-overview', 'aria-disabled') === 'true', 'navigation disabled before data is loaded');
  check(await page.locator('.feature').count() === 5, 'landing lists 5 feature areas');
  await shot('00-landing', false);

  console.log('Sample data: lands on Overview');
  await page.click('#landing-sample');
  await page.waitForFunction(() => location.hash === '#/overview');
  check(await total() === 5817000, 'overview total = 5,817,000 (43 lines)');
  check(await page.locator('#nav-strategy').count() === 0 && !(await page.textContent('#sidenav')).includes('benchmark'), 'no Executive benchmarks page in the navigation');
  check(JSON.stringify(await page.locator('#sidenav .nav-h').allTextContents()) === JSON.stringify(['Analyse', 'Key contracts', 'Plan', 'Data']), 'navigation groups: Analyse, Key contracts, Plan, Data');

  console.log('Sample data: every page renders');
  for (const [i, id] of PAGES.entries()) {
    await nav(id);
    const title = await page.textContent('.page-t');
    check(await page.getAttribute(`#nav-${id}`, 'aria-current') === 'page' && title.length > 0, `${id}: "${title}" renders and is marked current`);
    await shot(`${String(i + 1).padStart(2, '0')}-${id}`);
  }
  const br = await S(() => window.BudgetExplorer.computeBridge(window.BudgetExplorer.S.recs));
  check(br.added === 680000 && br.newCount === 6, 'bridge: 6 new lines worth 680,000 (blank or zero prior year)');
  check(Math.abs(br.prior + br.added + br.increases - br.decreases - br.removed - br.next) < 0.01, 'bridge reconciles');
  check(await S(() => window.BudgetExplorer.S.recs.filter((r) => r.row.join().match(/Contract,/)).length) === 0, 'no "Contract" category left in the sample (taxonomy: Hardware / Licence / Service)');

  console.log('Interactions');
  await nav('breakdown');
  await page.selectOption('#bd-group', { label:'Vendor' });
  check(await page.locator('#bd-table tbody tr').count() === 23, 'group by vendor → 23 rows');
  await page.locator('#bd-table tbody tr').first().click();
  check(await page.locator('#chips .chip').count() === 1, 'clicking a row adds a filter chip');
  await page.click('#filter-reset');
  await page.click('#bd-view [data-k="table"]');
  check(!(await page.isVisible('.hb-track')), 'view switch to table hides the chart');
  await page.click('#bd-view [data-k="both"]');

  await nav('vendors');
  check(await page.locator('svg[aria-label="Vendor Pareto chart"]').count() === 0 && await page.locator('#vendor-table').count() === 1, 'Vendors: Pareto chart removed, ranked table kept');
  check(!(await page.textContent('#page-insight')).includes('80%'), 'Vendors insight no longer quotes the Pareto 80% figure');
  await page.locator('#vendor-table tbody tr').first().click();
  check(await page.isVisible('#drawer') && (await page.textContent('#drawer-title')) === 'Northwind Software', 'vendor row opens the side panel');
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-20-vendor-drawer.png') });
  await page.locator('#drawer tbody tr').first().click();
  check((await page.textContent('#drawer-title')) === 'Office productivity suite', 'clicking a line in the panel opens line details');
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('#drawer')), 'Esc closes the panel');

  await nav('renewals');
  await page.click('#ren-seg [data-k="passed"]');
  await page.click('#ren-tabs [data-k="list"]');
  const overdue = await S(() => window.BudgetExplorer.S.recs.filter((r) => r.deadline != null && r.amount > 0 && Math.round(r.deadline - Date.parse(window.BudgetExplorer.S.opts.asOf + 'T00:00:00Z') / 864e5) < 0).length);
  check(await page.locator('#ren-list tbody tr').count() === overdue, `overdue segment lists ${overdue} lines`);
  await page.click('#ren-seg [data-k="all"]');
  await page.click('#ren-tabs [data-k="calendar"]');
  check(await page.locator('#ren-cal .cal-m').count() >= 12, 'calendar shows 12+ month cards');

  await nav('quality');
  await page.locator('#quality-table tbody button').first().click();
  await page.waitForFunction(() => window.BudgetExplorer.S.page === 'lines');
  check(await page.locator('#chips .chip').count() === 1, '"View rows" opens line items filtered by the check');
  await page.click('#filter-reset');

  await nav('lines');
  await page.selectOption('#l-size', '25');
  check(await page.locator('#table-lines tbody tr').count() === 25, 'page size 25 → 25 rows');
  await page.click('#l-next');
  check(await page.locator('#table-lines tbody tr').count() === 18, 'second page → 18 rows');

  console.log('Key contracts (fictional invoices in the sample)');
  const pm = await S(() => { const f = window.BudgetExplorer.periodMonths; return [f('2026-08-17', '2026-09-16'), f('2026-08-01', '2026-08-31'), f('2026-10-01', '2026-12-31'), f('2026-01-01', '2026-12-31'), +f('2026-03-01', '2026-03-14').toFixed(2)]; });
  check(JSON.stringify(pm) === '[1,1,3,12,0.46]', `service periods → months: 17th–16th = 1, calendar month = 1, quarter = 3, year = 12, 14 days = 0.46 (${JSON.stringify(pm)})`);
  await nav('c-contoso');
  check(await page.textContent('.page-t') === 'Contoso Cloud' && await page.locator('#filter-reset').count() === 0, 'contract page has its own title and no filter bar');
  check(await kpiVal('ct-annual') === 678000, 'Contoso: monthly invoice 56,500 × 12 = 678,000 a year');
  check(await kpiVal('ct-budget') === 758000, 'Contoso: budget = the 2 lines whose vendor matches (640,000 + 118,000)');
  check(await kpiVal('ct-gap') === 80000 && await page.locator('[data-kpi="ct-fx"]').count() === 0, 'Contoso: same currency, no exchange rate needed, headroom 80,000');
  check(await page.locator('#ct-lines tbody tr').count() === 6 && (await page.textContent('#ct-lines-card')).includes('Lines add up'), 'Contoso: 6 invoice lines that add up to the invoice total');
  check((await page.textContent('#page-insight')).includes('monthly invoice'), 'insight names the billing cadence');
  const dl = page.waitForEvent('download');
  await page.click('#export-csv');
  const file = await dl;
  const csv = require('fs').readFileSync(await file.path(), 'utf8');
  check(file.suggestedFilename() === 'contract-contoso-annualised.csv' && csv.trim().split(/\r?\n/).length === 7 && csv.includes('678000') === false && csv.includes('316800.00'), 'Export CSV: annualised invoice lines (compute 26,400 × 12 = 316,800.00)');
  await nav('c-fabrikam');
  check(await kpiVal('ct-annual') === 466400, 'Fabrikam: quarterly invoice 116,600 × 4 = 466,400 USD a year');
  check(Math.abs(await kpiVal('ct-fx') - 415096) < 0.01 && Math.abs(await kpiVal('ct-gap') - 25904) < 0.01, 'Fabrikam: USD invoice converted at the file\'s rate 0.89 = 415,096 EUR; headroom 25,904 vs 441,000');
  await page.fill('#ct-fx-rate', '0.95'); await page.press('#ct-fx-rate', 'Tab'); await page.waitForTimeout(100);
  check(Math.abs(await kpiVal('ct-gap') + 2080) < 0.01 && (await page.getAttribute('[data-kpi="ct-gap"]', 'class')).includes('alert'), 'typing your own rate (0.95) updates the comparison: 2,080 over budget, shown as an alert');
  await page.click('#ct-fx-reset');
  check(Math.abs(await kpiVal('ct-gap') - 25904) < 0.01, '"Use 0.89" restores the file\'s rate');
  await page.locator('#ct-bars button').first().click();
  check((await page.textContent('#drawer-title')) === 'Managed SOC service (24×7)', 'clicking the largest bar opens the invoice line details');
  await page.keyboard.press('Escape');

  console.log('Encoding');
  await loadFile(EX('examples/utf8-names.csv'), 'utf8-names.csv');
  check(JSON.stringify(await S(() => window.BudgetExplorer.S.rows.map((r) => r[2]))) === '["Zürich","Genève","Malmö"]', 'UTF-8 names (Zürich, Genève, Malmö) are read correctly');
  check(await total() === 6000, '€-prefixed amounts parse: total 6,000');

  console.log('Pivot-table export (Mac Roman, title row, subtotals, fill-down, dashes)');
  await loadFile(EX('examples/pivot-export-macroman.csv'), 'pivot-export-macroman.csv');
  check(await total() === 159169, 'subtotal and grand-total rows removed: total 159,169 (not double counted)');
  check(await S(() => window.BudgetExplorer.S.rows.length) === 10, '10 line rows kept');
  check(await S(() => window.BudgetExplorer.S.fileInfo[0].encoding) === 'Mac Roman', 'encoding detected as Mac Roman');
  check(JSON.stringify(await S(() => { const s = window.BudgetExplorer.S, v = s.map.vendor; return [...new Set(s.rows.map((r) => r[v]))]; })) === JSON.stringify(['1000 - Dummy', 'Northwind Software', 'Fabrikam Sàrl', 'Contoso Cloud', 'Wingtip Zürich AG']), 'vendor labels filled down; Sàrl / Zürich decoded correctly');
  check(await mapped('category') === 'Reporting Category', '"Reporting Category, Licences" title row becomes a column');
  const flags = await S(() => { const c = {}; for (const r of window.BudgetExplorer.S.recs) for (const f of r.flags) c[f] = (c[f] || 0) + 1; return c; });
  check(flags.vendor_placeholder === 4 && flags.open_question === 2 && flags.amount_zero === 1 && !flags.amount_bad, `checks: 4 placeholder-vendor lines, 2 open questions, 1 zero ("-") amount, no parse errors (${JSON.stringify(flags)})`);
  await nav('source');
  check((await page.textContent('#file-table')).includes('Yes'), 'Data source confirms the lines add up to the file\'s grand total');
  await shot('32-pivot-source', false);

  console.log('Hand-cleaned sheet (amount first, capability, tool names, reviewer notes)');
  await loadFile(EX('examples/cleaned-sheet.csv'), 'cleaned-sheet.csv');
  await page.waitForFunction(() => location.hash === '#/overview');
  check(await mapped('amount') === 'Sum of Total in USD' && await mapped('capability') === 'Capability' && await mapped('vendor') === 'Vendor', 'amount / capability / vendor detected; opens on Overview');
  check(await total() === 110720, 'total 110,720');
  const f2 = await S(() => { const c = {}; for (const r of window.BudgetExplorer.S.recs) for (const f of r.flags) c[f] = (c[f] || 0) + 1; return c; });
  check(f2.open_question === 2 && f2.vendor_placeholder === 1 && f2.unclassified_value === 1, `reviewer notes flagged: "unclear" + "double?" = 2 open questions, "Varied" vendor, "Unknown" capability (${JSON.stringify(f2)})`);

  console.log('EU finance export');
  await loadFile(EX('examples/finance-export-eu.csv'), 'finance-export-eu.csv');
  check(await total() === 5517000, 'total 5,517,000');
  check(await mapped('amount') === 'Budget FY2027' && await mapped('prior') === 'Budget FY2026', 'amount / prior = Budget FY2027 / FY2026');
  check(await mapped('renewal') === 'Contract end', 'renewal → Contract end');
  check(await S(() => window.BudgetExplorer.S.months.filter((c) => c != null).length) === 12, '12 month columns');

  console.log('Minimal file (3 columns)');
  await loadFile(EX('examples/minimal-us.csv'), 'minimal-us.csv');
  check(await total() === 5517000, 'total = 5,517,000');
  check((await page.getAttribute('#nav-renewals', 'class')).includes('muted'), 'renewals nav item muted (no date column)');
  await nav('renewals');
  check(await page.isVisible('#goto-source'), 'renewals page explains what is missing and links to mapping');
  await nav('c-contoso');
  check(await kpiVal('ct-budget') === 758000 && await page.textContent('[data-kpi="ct-gap"] .kpi-v') === '—' && (await page.textContent('[data-kpi="ct-gap"]')).includes('Needs an exchange rate'), 'EUR invoice vs USD budget with no rate: asks for an exchange rate instead of guessing');
  await nav('c-fabrikam');
  check(Math.abs(await kpiVal('ct-gap') + 25400) < 0.01 && (await page.textContent('[data-kpi="ct-gap"] .kpi-l')).includes('over budget'), 'USD invoice vs USD budget: 466,400 run-rate is 25,400 over the 441,000 budget');
  await shot('31-minimal-contract');

  console.log('Mapping');
  await loadFile(EX('sample-budget.csv'), 'sample-budget.csv');
  await nav('source');
  const priorCol = await S(() => window.BudgetExplorer.S.headers.indexOf('prior_year_budget'));
  await page.selectOption('#map-amount', String(priorCol));
  await page.selectOption('#map-prior', '');
  await page.click('#map-apply');
  await nav('overview');
  check(await total() === 5214500, 'amount switched to prior_year_budget → 5,214,500');
  await nav('source');
  await page.click('#map-reset'); await page.click('#map-apply');
  await nav('overview');
  check(await total() === 5517000, 're-detect restores annual_budget');

  console.log('Layout');
  await page.evaluate(() => window.BudgetExplorer.loadSample());
  await page.waitForFunction(() => location.hash === '#/overview');
  await page.setViewportSize({ width:390, height:844 });
  const overflow = () => S(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('#main').scrollWidth - document.querySelector('#main').clientWidth));
  let over = await overflow();
  check(over <= 0, `no horizontal scroll at 390px on Overview (overflow ${over}px)`);
  await page.evaluate(() => window.BudgetExplorer.go('c-fabrikam')); await page.waitForTimeout(100);
  over = await overflow();
  check(over <= 0, `no horizontal scroll at 390px on a contract page (overflow ${over}px)`);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-41-phone-contract.png'), fullPage:true });
  await page.evaluate(() => window.BudgetExplorer.go('overview')); await page.waitForTimeout(100);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-40-phone.png') });
  await page.click('#nav-toggle');
  await page.waitForTimeout(300);
  check(await page.isVisible('#nav-vendors'), 'hamburger opens the side panel on phones');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width:1440, height:900 });
  await page.emulateMedia({ colorScheme:'dark' });
  await page.evaluate(() => window.BudgetExplorer.go('c-contoso')); await page.waitForTimeout(100);
  await shot('42-dark-contract');

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
