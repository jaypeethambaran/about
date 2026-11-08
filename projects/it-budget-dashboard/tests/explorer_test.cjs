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
const PAGES = ['strategy', 'overview', 'breakdown', 'vendors', 'organisation', 'renewals', 'cashflow', 'yoy', 'lines', 'quality', 'source'];

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

  console.log('Sample data: lands on Executive benchmarks');
  await page.click('#landing-sample');
  await page.waitForFunction(() => location.hash === '#/strategy');
  check(await mapped('capability') === 'business_capability' && await mapped('spend_cat') === 'spend_category', 'capability and spend-type columns detected');
  check(await kpiVal('bench-total') === 5817000, 'IT spend in scope = 5,817,000 (43 lines)');
  check(await page.textContent('[data-kpi="bench-rev"] .kpi-v') === '—', 'no revenue entered → no % of revenue shown (no invented defaults)');
  check((await page.textContent('#page-insight')).includes('enter company revenue and headcount'), 'insight asks for company figures');
  await page.fill('#co-rev', '100000000'); await page.press('#co-rev', 'Tab'); await page.waitForTimeout(100);
  await page.fill('#co-fte', '500'); await page.press('#co-fte', 'Tab'); await page.waitForTimeout(100);
  check(Math.abs(await kpiVal('bench-rev') - 0.05817) < 1e-9, '% of revenue = 5.8% after entering revenue 100m');
  check(Math.abs(await kpiVal('bench-fte') - 11634) < 1e-6, 'per FTE = 11,634 after entering 500 FTE');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'co-other', 'Tab after editing moves focus to the next field (not lost on re-render)');
  await page.fill('#co-other', '2183000'); await page.press('#co-other', 'Tab'); await page.waitForTimeout(100);
  check(await kpiVal('bench-total') === 8000000, 'other IT spend is added: 5,817,000 + 2,183,000 = 8,000,000');
  check(Math.abs(await kpiVal('bench-transform') - 300000 / 5817000) < 1e-9, 'Transform share = 300k / 5.817m');
  const rgt = await page.locator('#rgt-table tbody tr').allTextContents();
  check(rgt.length === 3 && rgt[0].includes('Run') && rgt[0].includes('64.8%') && rgt[1].includes('30.0%') && rgt[2].includes('5.2%'), 'Run / Grow / Transform = 64.8% / 30.0% / 5.2%');
  await page.locator('#rgt-table tbody tr').nth(2).click();
  check(await page.locator('#chips .chip').count() === 1 && await kpiVal('bench-total') === 300000, 'clicking Transform filters to 300k and drops other IT spend');
  await page.click('#filter-reset');
  check(await page.locator('#cap-table tbody tr').count() === 4, '4 business capabilities listed');
  await shot('01-strategy');

  console.log('Sample data: every page renders');
  check(await total().catch(() => null) === null, '(overview tile not on this page)');
  for (const [i, id] of PAGES.entries()) {
    await nav(id);
    const title = await page.textContent('.page-t');
    check(await page.getAttribute(`#nav-${id}`, 'aria-current') === 'page' && title.length > 0, `${id}: "${title}" renders and is marked current`);
    if (id !== 'strategy') await shot(`${String(i + 1).padStart(2, '0')}-${id}`);
  }
  await nav('overview');
  check(await total() === 5817000, 'overview total = 5,817,000');
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

  console.log('Encoding');
  await loadFile(EX('examples/utf8-names.csv'), 'utf8-names.csv');
  check(JSON.stringify(await S(() => window.BudgetExplorer.S.rows.map((r) => r[2]))) === '["Zürich","Genève","Malmö"]', 'UTF-8 names (Zürich, Genève, Malmö) are read correctly');
  check(await total() === 6000, '€-prefixed amounts parse: total 6,000');

  console.log('EU finance export');
  await loadFile(EX('examples/finance-export-eu.csv'), 'finance-export-eu.csv');
  check(await total() === 5517000, 'lands on Overview (no strategy columns) with total 5,517,000');
  check(await mapped('amount') === 'Budget FY2027' && await mapped('prior') === 'Budget FY2026', 'amount / prior = Budget FY2027 / FY2026');
  check(await mapped('renewal') === 'Contract end', 'renewal → Contract end');
  check(await S(() => window.BudgetExplorer.S.months.filter((c) => c != null).length) === 12, '12 month columns');

  console.log('Minimal file (3 columns)');
  await loadFile(EX('examples/minimal-us.csv'), 'minimal-us.csv');
  check(await total() === 5517000, 'total = 5,517,000');
  check((await page.getAttribute('#nav-renewals', 'class')).includes('muted'), 'renewals nav item muted (no date column)');
  await nav('renewals');
  check(await page.isVisible('#goto-source'), 'renewals page explains what is missing and links to mapping');
  await nav('strategy');
  check(await page.locator('.empty-state').count() === 2, 'benchmarks page explains the missing spend-type and capability columns');
  await shot('31-minimal-strategy');

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
  await page.waitForFunction(() => location.hash === '#/strategy');
  await page.setViewportSize({ width:390, height:844 });
  const over = await S(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('#main').scrollWidth - document.querySelector('#main').clientWidth));
  check(over <= 0, `no horizontal scroll at 390px on benchmarks (overflow ${over}px)`);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-40-phone.png') });
  await page.click('#nav-toggle');
  await page.waitForTimeout(300);
  check(await page.isVisible('#nav-vendors'), 'hamburger opens the side panel on phones');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width:1440, height:900 });
  await page.emulateMedia({ colorScheme:'dark' });
  await shot('42-dark-strategy');

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
