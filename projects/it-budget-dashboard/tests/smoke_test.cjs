// Browser smoke test for site/index.html, opened straight from disk (file://).
// Needs Node and Playwright with Chromium. Optional: skip it if Playwright isn't available.
//
//   node tests/smoke_test.cjs                    # checks only
//   SCREENSHOT_DIR=/some/dir node tests/smoke_test.cjs   # also saves screenshots
const path = require('path');
const { chromium } = require('playwright');

const page_url = 'file://' + path.resolve(__dirname, '..', 'site', 'index.html');
const shots = process.env.SCREENSHOT_DIR;
let failures = 0;
const check = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(page_url);
  await page.waitForSelector('[data-kpi="total"]');

  const expected = await page.evaluate(() => window.BUDGET_DATA.lines.reduce((a, l) => a + l.annual_budget, 0));
  const shown = Number(await page.getAttribute('[data-kpi="total"] .value', 'data-value'));
  check(Math.abs(shown - expected) < 0.01, `total tile ${shown} equals sum of lines ${expected}`);

  const allRows = await page.locator('#table-lines tbody tr').count();
  check(allRows === (await page.evaluate(() => window.BUDGET_DATA.lines.length)), `line table shows all ${allRows} lines`);
  check(await page.locator('#chart-timeline circle').count() > 0, 'renewal timeline has dots');
  check(await page.locator('#chart-phasing rect').count() > 0, 'phasing chart has bars');
  check(await page.locator('#chart-bridge rect').count() === 6, 'bridge chart has 6 steps');

  // bridge must reconcile: prior + changes = budget-year total
  const b = await page.evaluate(() => window.BudgetDashboard.computeBridge(window.BUDGET_DATA.lines));
  check(Math.abs(b.prior + b.added + b.increases - b.decreases - b.removed - b.next) < 0.01, 'bridge reconciles');

  if (shots) await page.screenshot({ path: path.join(shots, 'dashboard-full.png'), fullPage: true });

  // drill-down: click the top vendor bar → every view filters, URL hash updates
  const vendor = await page.locator('#chart-vendor button.hbar .name').first().textContent();
  await page.locator('#chart-vendor button.hbar').first().click();
  const expectedRows = await page.evaluate((v) => window.BUDGET_DATA.lines.filter((l) => l.vendor === v).length, vendor);
  check(await page.locator('#table-lines tbody tr').count() === expectedRows, `vendor filter "${vendor}" → ${expectedRows} rows`);
  check((await page.evaluate(() => location.hash)).includes('vendor='), 'filter is stored in URL hash');
  check(await page.locator('#active-chips .chip').count() === 1, 'active filter chip shown');
  await page.click('#filter-reset');
  check(await page.locator('#table-lines tbody tr').count() === allRows, 'reset restores all lines');

  // search box
  await page.fill('#filter-q', 'ERP');
  await page.waitForTimeout(300);
  const erp = await page.evaluate(() => window.BUDGET_DATA.lines.filter((l) => window.BudgetDashboard.state && [l.line_id, l.vendor, l.product_or_service, l.notes, l.owner, l.cost_centre, l.cost_pool].join(' ').toLowerCase().includes('erp')).length);
  check(erp > 0 && await page.locator('#table-lines tbody tr').count() === erp, `search "ERP" → ${erp} rows`);
  await page.click('#filter-reset');

  // phone width: no horizontal page scroll
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `no horizontal page scroll at 390px (overflow ${overflow}px)`);
  if (shots) await page.screenshot({ path: path.join(shots, 'dashboard-phone.png'), fullPage: false });

  // dark mode renders
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  if (shots) await page.screenshot({ path: path.join(shots, 'dashboard-dark.png'), fullPage: false });

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
