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
const PAGES = ['overview', 'breakdown', 'vendors', 'organisation', 'renewals', 'cashflow', 'yoy', 'lines', 'quality', 'source'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const total = () => page.getAttribute('[data-kpi="total"] .kpi-v', 'data-value').then(Number);
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

  await page.goto(URL);
  console.log('Landing');
  check(await page.isVisible('#landing-sample'), 'landing shows "Use sample data"');
  check(await page.getAttribute('#nav-overview', 'aria-disabled') === 'true', 'navigation disabled before data is loaded');
  await shot('00-landing', false);

  console.log('Sample data: every page renders');
  await page.click('#landing-sample');
  await page.waitForFunction(() => location.hash === '#/overview');
  check(await total() === 5517000, 'overview total = 5,517,000');
  check(await mapped('renewal') === 'renewal_date', 'renewal → renewal_date');
  check(await page.textContent('#nav-renewals .nav-badge') !== null, 'renewals nav item shows a badge');
  for (const [i, id] of PAGES.entries()) {
    await nav(id);
    const title = await page.textContent('.page-t');
    const cur = await page.getAttribute(`#nav-${id}`, 'aria-current');
    check(cur === 'page' && title.length > 0, `${id}: "${title}" renders and is marked current`);
    await shot(`${String(i + 1).padStart(2, '0')}-${id}`);
  }

  console.log('Interactions');
  await nav('breakdown');
  await page.selectOption('#bd-group', { label:'Vendor' });
  check(await page.locator('#bd-table tbody tr').count() === 20, 'group by vendor → 20 rows in table');
  await page.locator('#bd-table tbody tr').first().click();
  check(await page.locator('#chips .chip').count() === 1, 'clicking a row adds a filter chip');
  check(await page.textContent('[aria-current="page"] .nav-l') === 'Spend breakdown', 'filtering keeps you on the page');
  await page.click('#filter-reset');
  await page.click('#bd-view [data-k="table"]');
  check(!(await page.isVisible('.hb-track')), 'view switch to table hides the chart');
  await page.click('#bd-view [data-k="both"]');

  await nav('vendors');
  await page.locator('#vendor-table tbody tr').first().click();
  check(await page.isVisible('#drawer'), 'vendor row opens the side panel');
  check((await page.textContent('#drawer-title')) === 'Northwind Software', 'panel shows the top vendor');
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
  await shot('21-renewals-calendar');

  await nav('quality');
  await page.locator('#quality-table tbody button').first().click();
  await page.waitForFunction(() => window.BudgetExplorer.S.page === 'lines');
  check(await page.locator('#chips .chip').count() === 1, '"View rows" opens line items filtered by the check');
  await page.click('#filter-reset');

  await nav('lines');
  await page.selectOption('#l-size', '25');
  check(await page.locator('#table-lines tbody tr').count() === 25, 'page size 25 → 25 rows');
  await page.click('#l-next');
  check(await page.locator('#table-lines tbody tr').count() === 16, 'second page → 16 rows');

  console.log('EU finance export');
  await page.setInputFiles('#file-input', EX('examples/finance-export-eu.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files[0] === 'finance-export-eu.csv' && location.hash === '#/overview');
  check(await total() === 5517000, 'total = 5,517,000');
  check(await mapped('amount') === 'Budget FY2027' && await mapped('prior') === 'Budget FY2026', 'amount / prior = Budget FY2027 / FY2026');
  check(await mapped('renewal') === 'Contract end', 'renewal → Contract end');
  check(await S(() => window.BudgetExplorer.S.months.filter((c) => c != null).length) === 12, '12 month columns');
  await shot('30-eu-overview');

  console.log('Minimal file (3 columns)');
  await page.setInputFiles('#file-input', EX('examples/minimal-us.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files[0] === 'minimal-us.csv' && location.hash === '#/overview');
  check(await total() === 5517000, 'total = 5,517,000');
  check((await page.getAttribute('#nav-renewals', 'class')).includes('muted'), 'renewals nav item muted (no date column)');
  await nav('renewals');
  check(await page.isVisible('#goto-source'), 'renewals page explains what is missing and links to mapping');
  await shot('31-minimal-unavailable', false);

  console.log('Mapping');
  await page.setInputFiles('#file-input', EX('sample-budget.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files[0] === 'sample-budget.csv' && location.hash === '#/overview');
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
  await page.setViewportSize({ width:390, height:844 });
  const over = await S(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('#main').scrollWidth - document.querySelector('#main').clientWidth));
  check(over <= 0, `no horizontal scroll at 390px (overflow ${over}px)`);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-40-phone.png') });
  await page.click('#nav-toggle');
  check(await page.isVisible('#nav-vendors'), 'hamburger opens the side panel on phones');
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-41-phone-nav.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width:1440, height:900 });
  await page.emulateMedia({ colorScheme:'dark' });
  await shot('42-dark-overview');

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
