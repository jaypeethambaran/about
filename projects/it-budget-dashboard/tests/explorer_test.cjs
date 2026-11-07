// Browser test for explorer/budget-explorer.html: loads differently shaped CSVs and checks the results.
//   node tests/explorer_test.cjs
//   SCREENSHOT_DIR=/some/dir node tests/explorer_test.cjs   # also saves screenshots
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'explorer', 'budget-explorer.html');
const EX = (f) => path.join(ROOT, 'data', ...f.split('/'));
const shots = process.env.SCREENSHOT_DIR;
let failures = 0;
const check = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) failures++; };
const total = (page) => page.getAttribute('[data-kpi="total"] .value', 'data-value').then(Number);
const header = (page, key) => page.evaluate((k) => { const S = window.BudgetExplorer.S; return S.map[k] == null ? null : S.headers[S.map[k]]; }, key);
const visible = (page, id) => page.isVisible('#' + id);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1360, height:900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-landing.png') });

  console.log('Sample data (template layout)');
  await page.click('#landing-sample');
  check(await total(page) === 5517000, 'total = 5,517,000');
  check(await header(page, 'amount') === 'annual_budget', 'amount → annual_budget');
  check(await header(page, 'prior') === 'prior_year_budget', 'prior → prior_year_budget');
  check(await header(page, 'renewal') === 'renewal_date', 'renewal → renewal_date (not contract_end)');
  check(await visible(page, 'sec-renewals') && await visible(page, 'sec-phasing') && await visible(page, 'sec-bridge'), 'renewals, phasing and bridge sections shown');
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-sample.png'), fullPage:true });

  // drill-down on the second breakdown card (vendor)
  const bar = page.locator('#breakdowns article').nth(1).locator('button.hbar').first();
  const vendor = await bar.locator('.name').textContent();
  await bar.click();
  const rows = await page.locator('#table-lines tbody tr').count();
  const expected = await page.evaluate((v) => window.BudgetExplorer.S.recs.filter((r) => r.vendor === v).length, vendor);
  check(rows === expected, `click "${vendor}" → ${rows} rows`);
  await page.click('#filter-reset');

  // change a breakdown to another column
  const sel = page.locator('#breakdowns article').first().locator('select');
  await sel.selectOption({ label:'tower  ·  text' }).catch(() => sel.selectOption({ index:3 }));
  check(await page.locator('#breakdowns article').first().locator('button.hbar').count() > 0, 'breakdown column can be changed');

  // data-quality "Show" filter
  await page.click('#sec-quality summary');
  await page.locator('#table-quality button').first().click();
  check(await page.locator('#chips .chip').count() === 1, 'data-quality check filters rows');
  await page.click('#filter-reset');

  console.log('EU finance export (semicolons, 1.234,50, dd.mm.yyyy, title row, other headers)');
  await page.setInputFiles('#file-input', EX('examples/finance-export-eu.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files[0] === 'finance-export-eu.csv');
  check(await total(page) === 5517000, 'total = 5,517,000');
  check(await header(page, 'amount') === 'Budget FY2027', 'amount → Budget FY2027 (latest year)');
  check(await header(page, 'prior') === 'Budget FY2026', 'prior → Budget FY2026');
  check(await header(page, 'renewal') === 'Contract end', 'renewal → Contract end');
  check(await header(page, 'costcentre') === 'Department' && await header(page, 'owner') === 'Budget holder', 'department / budget holder detected');
  check(await page.evaluate(() => window.BudgetExplorer.S.months.filter((c) => c != null).length) === 12, '12 month columns detected');
  const bridge = await page.evaluate(() => window.BudgetExplorer.computeBridge(window.BudgetExplorer.S.recs));
  check(bridge.prior === 5214500, `prior-year total = ${bridge.prior}`);
  check(await page.evaluate(() => window.BudgetExplorer.S.opts.label) === 'FY2027', 'label = FY2027 from header');
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-eu.png'), fullPage:false });

  console.log('Minimal US file (3 columns, $1,234.00)');
  await page.setInputFiles('#file-input', EX('examples/minimal-us.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files[0] === 'minimal-us.csv');
  check(await total(page) === 5517000, 'total = 5,517,000');
  check(await page.evaluate(() => window.BudgetExplorer.S.opts.currency) === 'USD', 'currency USD detected');
  check(!(await visible(page, 'sec-renewals')) && !(await visible(page, 'sec-phasing')) && !(await visible(page, 'sec-bridge')), 'optional sections hidden');
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-minimal.png'), fullPage:true });

  console.log('Two files at once');
  await page.setInputFiles('#file-input', [EX('sample-budget.csv'), EX('examples/minimal-us.csv')]);
  await page.waitForFunction(() => window.BudgetExplorer.S.files.length === 2);
  check(await page.evaluate(() => window.BudgetExplorer.S.headers.includes('Source file')), '"Source file" column added');

  console.log('Mapping can be changed by hand');
  await page.setInputFiles('#file-input', EX('sample-budget.csv'));
  await page.waitForFunction(() => window.BudgetExplorer.S.files.length === 1 && window.BudgetExplorer.S.files[0] === 'sample-budget.csv');
  await page.click('#mapping summary');
  const priorCol = await page.evaluate(() => window.BudgetExplorer.S.headers.indexOf('prior_year_budget'));
  await page.selectOption('#map-amount', String(priorCol));
  await page.selectOption('#map-prior', '');
  await page.click('#map-apply');
  check(await total(page) === 5214500, 'amount switched to prior_year_budget → 5,214,500');
  check(!(await visible(page, 'sec-bridge')), 'bridge hidden when no prior column');
  await page.click('#mapping summary'); await page.click('#map-reset'); await page.click('#map-apply');
  check(await total(page) === 5517000, 're-detect restores annual_budget');

  console.log('Layout');
  await page.setViewportSize({ width:390, height:844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `no horizontal scroll at 390px (overflow ${overflow}px)`);
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-phone.png') });
  await page.setViewportSize({ width:1360, height:900 });
  await page.emulateMedia({ colorScheme:'dark' });
  if (shots) await page.screenshot({ path:path.join(shots, 'explorer-dark.png'), fullPage:true });

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
