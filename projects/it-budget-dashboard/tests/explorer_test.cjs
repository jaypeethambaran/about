// Browser test for explorer/corporate-it-budget-tracker.html (multi-page app shell).
//   node tests/explorer_test.cjs
//   SCREENSHOT_DIR=/some/dir node tests/explorer_test.cjs   # also saves a screenshot of every page
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'explorer', 'corporate-it-budget-tracker.html');
const EX = (f) => path.join(ROOT, 'data', ...f.split('/'));
const shots = process.env.SCREENSHOT_DIR;
let failures = 0;
const check = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) failures++; };
const PAGES = ['map', 'breakdown', 'organisation', 'contracts', 'c-contoso', 'c-proseware', 'c-fabrikam', 'yoy', 'lines', 'quality', 'source'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const kpiVal = (id) => page.getAttribute(`[data-kpi="${id}"] .kpi-v`, 'data-value').then(Number);
  const total = () => S(() => Math.round(window.BudgetTracker.S.recs.reduce((a, r) => a + r.amount, 0)));
  const mapped = (key) => S((k) => { const s = window.BudgetTracker.S; return s.map[k] == null ? null : s.headers[s.map[k]]; }, key);
  const shot = async (name, tall = true) => {
    if (!shots) return;
    if (tall) {
      const hgt = await page.evaluate(() => document.querySelector('#main').scrollHeight + 48);
      await page.setViewportSize({ width:1440, height:Math.min(Math.max(900, hgt), 5000) });
    }
    await page.screenshot({ path:path.join(shots, `ex-${name}.png`) });
    await page.setViewportSize({ width:1440, height:900 });
  };
  const nav = async (id) => { await page.click(`#nav-${id}`); await page.waitForFunction((p) => window.BudgetTracker.S.page === p, id); };
  const loadFile = async (files, name) => {
    await page.setInputFiles('#file-input', files);
    await page.waitForFunction((n) => window.BudgetTracker.S.files[0] === n, name);
    await page.waitForTimeout(100);
  };

  await page.goto(URL);
  console.log('Landing');
  check(await page.isVisible('#landing-sample'), 'landing shows "Use sample data"');
  check(await page.getAttribute('#nav-map', 'aria-disabled') === 'true', 'navigation disabled before data is loaded');
  check(await page.locator('.feature').count() === 4, 'landing lists 4 feature areas');
  check(await page.title() === 'Corporate IT Budget Tracker' && (await page.textContent('.brand')).includes('Corporate IT Budget Tracker'), 'app is called Corporate IT Budget Tracker');
  await shot('00-landing', false);

  console.log('Sample data: lands on the Spend map (the home page)');
  await page.click('#landing-sample');
  await page.waitForFunction(() => location.hash === '#/map');
  await page.waitForSelector('#tm-map .tile');
  check(await total() === 5817000 && await page.getAttribute('#map-total', 'data-value') === '5817000', 'total = 5,817,000 (43 lines), shown in the map side panel');
  check((await page.locator('#sidenav .nav-a').first().getAttribute('id')) === 'nav-map' && await page.title() === 'Spend map · Corporate IT Budget Tracker', 'Spend map is first in the navigation and is the page that opens');
  check(await page.locator('#nav-overview, #nav-renewals, #nav-cashflow, #nav-vendors, #nav-app').count() === 0, 'no Overview, Renewals, Cash flow or Vendors pages; application pages are not in the navigation');
  for (const old of ['overview', 'renewals', 'cashflow', 'vendors']) {
    await page.evaluate((x) => { location.hash = '#/' + x; }, old);
    await page.waitForFunction(() => window.BudgetTracker.S.page === 'map');
  }
  check(true, 'old links to Overview, Renewals, Cash flow and Vendors open the Spend map instead');
  await page.waitForSelector('#tm-map .tile');
  const slices = await S(() => { const s = window.BudgetTracker.S; return new Set(s.recs.filter((r) => r.amount > 0).map((r) => r.vendor + '|' + r.row[s.map.capability])).size; });
  check(await page.locator('#tm-map .tile').count() === slices, `map: one tile per vendor and department (${slices})`);
  check(await page.locator('#tm-map .gh').count() === 4 && (await page.locator('#tm-map .gh text').first().textContent()).startsWith('Enterprise IT'), 'map regions = the 4 business capabilities, largest first');
  await page.locator('#tm-map .gh').first().click();
  check((await page.textContent('.map-crumbs b')) === 'Enterprise IT' && (await page.textContent('#map-side h2')) === 'Enterprise IT', 'clicking a region zooms into it');
  await page.click('#ms-lines');
  await page.waitForFunction(() => window.BudgetTracker.S.page === 'lines');
  check(await page.locator('#chips .chip').count() === 1, '"List its lines" on a zoomed department opens Line items filtered to it');
  await page.click('#filter-reset');
  await nav('map'); await page.click('#map-root'); await page.waitForSelector('#tm-map .tile');
  await page.click('#map-mode [data-k="band"]'); await page.waitForTimeout(100);
  check(await page.locator('#tm-map .tile').count() === 23, 'size-band view: 23 vendor tiles in their bands');
  await page.click('#map-mode [data-k="contract"]'); await page.waitForTimeout(100);
  check((await page.locator('#tm-map .gh text').allTextContents()).some((x) => x.startsWith('Key contracts')), 'key-contract view splits contracted vendors from the rest');
  await page.click('#map-mode [data-k="dept"]'); await page.waitForTimeout(100);
  await page.locator('#tm-map .tile[data-k="Northwind Software"]').first().click();
  check((await page.textContent('#ms-name')) === 'Northwind Software', 'clicking a tile shows the vendor in the side panel');
  await page.click('#ms-open');
  await page.waitForFunction(() => window.BudgetTracker.S.page === 'app');
  check(await page.evaluate(() => location.hash) === '#/app/Northwind%20Software' && (await page.textContent('.page-t')) === 'Northwind Software', '"Open application page" opens #/app/Northwind Software');

  console.log('Application page (mosaic)');
  const nw = await S(() => window.BudgetTracker.S.recs.filter((r) => r.vendor === 'Northwind Software'));
  const nwTotal = nw.reduce((a, r) => a + r.amount, 0);
  check(+(await page.getAttribute('#app-total', 'data-value')) === nwTotal, `hero total = ${nwTotal}`);
  const unit = +(await page.getAttribute('#app-mosaic', 'data-unit'));
  check(await page.locator('#app-mosaic rect.q').count() === Math.round(nwTotal / unit) && (await page.textContent('.mhero small')).includes('1 square ='), `mosaic: ${Math.round(nwTotal / unit)} squares of ${unit}`);
  check(await page.locator('#app-dept rect.q').count() > 0 && await page.locator('#app-all rect.q').count() > 0, 'context mosaics: within its department and within the whole budget');
  check(await page.locator('#app-lines tbody tr').count() === nw.length, `lines table lists its ${nw.length} lines`);
  await page.locator('#app-lines tbody tr').first().click();
  check((await page.textContent('#drawer-title')) === 'Office productivity suite', 'clicking a line opens line details');
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-20-app-drawer.png') });
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('#drawer')), 'Esc closes the panel');
  await page.click('#app-next'); await page.waitForFunction(() => window.BudgetTracker.S.app !== 'Northwind Software');
  check(await page.locator('#app-mosaic').count() === 1, 'next application by rank opens');
  await page.evaluate(() => window.BudgetTracker.go('app/' + encodeURIComponent('Contoso Cloud'))); await page.waitForFunction(() => window.BudgetTracker.S.app === 'Contoso Cloud');
  check(await page.locator('#app-contract').count() === 1 && await page.locator('#app-mosaic rect.hollow').count() > 0, 'a key-contract vendor links to its contract page and shows unused budget as hollow squares');
  await page.evaluate(() => window.BudgetTracker.go('app/' + encodeURIComponent('No such vendor'))); await page.waitForTimeout(100);
  check((await page.textContent('#main')).includes('Application not found'), 'an unknown application shows a clear message');
  await nav('map');

  console.log('Sample data: every page renders');
  for (const [i, id] of PAGES.entries()) {
    await nav(id);
    const title = await page.textContent('.page-t');
    check(await page.getAttribute(`#nav-${id}`, 'aria-current') === 'page' && title.length > 0, `${id}: "${title}" renders and is marked current`);
    await shot(`${String(i + 1).padStart(2, '0')}-${id}`);
  }
  const br = await S(() => window.BudgetTracker.computeBridge(window.BudgetTracker.S.recs));
  check(br.added === 680000 && br.newCount === 6, 'bridge: 6 new lines worth 680,000 (blank or zero prior year)');
  check(Math.abs(br.prior + br.added + br.increases - br.decreases - br.removed - br.next) < 0.01, 'bridge reconciles');
  check(await S(() => window.BudgetTracker.S.recs.filter((r) => r.row.join().match(/Contract,/)).length) === 0, 'no "Contract" category left in the sample (taxonomy: Hardware / Licence / Service)');

  console.log('Interactions');
  await nav('breakdown');
  await page.selectOption('#bd-group', { label:'Vendor' });
  check(await page.locator('#bd-table tbody tr').count() === 23, 'group by vendor → 23 rows');
  await page.locator('#bd-table tbody tr').first().click();
  check(await page.locator('#chips .chip').count() === 1, 'clicking a row adds a filter chip');
  await page.click('#filter-reset');
  await page.waitForSelector('#tm-bd .tile');
  check(await page.locator('#tm-bd .tile').count() > 0, 'breakdown is drawn as a map');

  await nav('contracts'); await page.waitForSelector('#tm-contracts .tile');
  check(await page.locator('#contracts-list li').count() === 3 && Math.abs(+(await page.getAttribute('#ct-all-gap', 'data-value')) - 107904) < 0.01, 'all contracts: 3 contracts, run-rate 107,904 below budget in total (80,000 + 2,000 + 25,904)');
  check(await page.locator('#tm-contracts rect[style*="hatch"]').count() >= 1, 'unused contract budget is hatched on the contracts map');
  await page.locator('#contracts-list li').first().click(); await page.waitForFunction(() => window.BudgetTracker.S.page.startsWith('c-'));
  check(true, 'a contract in the list opens its page');

  await nav('yoy'); await page.waitForSelector('#tm-yoy .tile');
  check((await page.textContent('#yoy-side')).includes('(6 lines)') && await page.locator('#tm-yoy .tile').count() > 0, 'year over year: map coloured by change, bridge lists 6 new lines');
  await nav('organisation'); await page.waitForSelector('#tm-org .tile');
  check(await page.locator('#org-owners tbody tr.hl').count() === 1, 'cost centres & owners: map plus owner table with the "no owner" row highlighted');

  await nav('quality');
  await page.locator('#quality-table tbody button').first().click();
  await page.waitForFunction(() => window.BudgetTracker.S.page === 'lines');
  check(await page.locator('#chips .chip').count() === 1, '"View rows" opens line items filtered by the check');
  await page.click('#filter-reset');

  await nav('lines');
  await page.selectOption('#l-size', '25');
  check(await page.locator('#table-lines tbody tr').count() === 25, 'page size 25 → 25 rows');
  await page.click('#l-next');
  check(await page.locator('#table-lines tbody tr').count() === 18, 'second page → 18 rows');

  console.log('Key contracts (fictional invoices in the sample)');
  const pm = await S(() => { const f = window.BudgetTracker.periodMonths; return [f('2026-08-17', '2026-09-16'), f('2026-08-01', '2026-08-31'), f('2026-10-01', '2026-12-31'), f('2026-01-01', '2026-12-31'), +f('2026-03-01', '2026-03-14').toFixed(2)]; });
  check(JSON.stringify(pm) === '[1,1,3,12,0.46]', `service periods → months: 17th–16th = 1, calendar month = 1, quarter = 3, year = 12, 14 days = 0.46 (${JSON.stringify(pm)})`);
  await nav('c-contoso');
  check(await page.textContent('.page-t') === 'Contoso Cloud' && await page.locator('#filter-reset').count() === 0, 'contract page has its own title and no filter bar');
  check(await kpiVal('ct-annual') === 678000, 'Contoso: monthly invoice 56,500 × 12 = 678,000 a year');
  check(await kpiVal('ct-budget') === 758000, 'Contoso: budget = the 2 lines whose vendor matches (640,000 + 118,000)');
  check(await kpiVal('ct-gap') === 80000 && await page.locator('[data-kpi="ct-fx"]').count() === 0, 'Contoso: same currency, no exchange rate needed, headroom 80,000');
  check(await page.locator('#ct-lines tbody tr').count() === 7 && await page.locator('#ct-lines tbody tr.ended').count() === 1 && (await page.textContent('#ct-lines-card')).includes('Lines add up'), 'Contoso: 6 current invoice lines that add up to the invoice total, plus 1 from a replaced quote');
  check(await page.isVisible('#ct-warning') && (await page.textContent('[data-kpi="ct-annual"]')).includes('replaced order'), 'contract notice banner shown; replaced quote left out of the run-rate');
  { const b = +(await page.getAttribute('#ct-mosaic', 'data-b')), r = +(await page.getAttribute('#ct-mosaic', 'data-r'));
    check(b > r && await page.locator('#ct-mosaic rect.hollow').count() === b - r && await page.locator('#ct-mosaic rect.over').count() === 0, `contract mosaic: ${r} solid squares (run-rate) inside ${b} budget squares, ${b - r} hollow`); }
  check((await page.textContent('#page-insight')).includes('monthly invoice'), 'insight names the billing cadence');
  const dl = page.waitForEvent('download');
  await page.click('#export-csv');
  const file = await dl;
  const csv = require('fs').readFileSync(await file.path(), 'utf8');
  check(file.suggestedFilename() === 'contract-contoso-annualised.csv' && csv.trim().split(/\r?\n/).length === 8 && csv.includes('678000') === false && csv.includes('316800.00'), 'Export CSV: annualised invoice lines (compute 26,400 × 12 = 316,800.00)');
  await nav('c-fabrikam');
  check(await kpiVal('ct-annual') === 466400, 'Fabrikam: quarterly invoice 116,600 × 4 = 466,400 USD a year');
  check(Math.abs(await kpiVal('ct-fx') - 415096) < 0.01 && Math.abs(await kpiVal('ct-gap') - 25904) < 0.01, 'Fabrikam: USD invoice converted at the file\'s rate 0.89 = 415,096 EUR; headroom 25,904 vs 441,000');
  await page.fill('#ct-fx-rate', '0.95'); await page.press('#ct-fx-rate', 'Tab'); await page.waitForTimeout(100);
  check(Math.abs(await kpiVal('ct-gap') + 2080) < 0.01 && (await page.getAttribute('[data-kpi="ct-gap"]', 'class')).includes('alert'), 'typing your own rate (0.95) updates the comparison: 2,080 over budget, shown as an alert');
  { const b = +(await page.getAttribute('#ct-mosaic', 'data-b')), r = +(await page.getAttribute('#ct-mosaic', 'data-r'));
    check(r > b && await page.locator('#ct-mosaic rect.over').count() === r - b, `over budget: ${r - b} square(s) beyond the budget outlined red`); }
  await page.click('#ct-fx-reset');
  check(Math.abs(await kpiVal('ct-gap') - 25904) < 0.01, '"Use 0.89" restores the file\'s rate');
  await page.locator('#ct-bars button').first().click();
  check((await page.textContent('#drawer-title')) === 'Managed SOC service (24×7)', 'clicking the largest bar opens the invoice line details');
  await page.keyboard.press('Escape');
  check(await page.locator('#ct-lines tbody tr').count() === 4 && await page.locator('#ct-lines tbody tr.ended').count() === 1, 'ended onboarding invoice is listed but greyed out');
  check((await page.textContent('[data-kpi="ct-annual"]')).includes('Not counted: 1 ended line') && await kpiVal('ct-annual') === 466400, 'ended invoice is left out of the run-rate (annual line ×1 + quarterly lines ×4 = 466,400)');
  check(await page.getAttribute('[data-kpi="ct-term"] .kpi-v', 'data-value') === '2029-09-30' && (await page.textContent('[data-kpi="ct-term"] .kpi-l')).includes('Contract ends'), 'contract ends 30 Sep 2029 (term from the order)');
  await S(() => { window.BudgetTracker.S.opts.asOf = '2026-11-08'; }); await page.evaluate(() => window.BudgetTracker.go('c-fabrikam')); await page.click('#nav-map'); await nav('c-fabrikam');
  check(await page.locator('#ct-years .yrow').count() === 3, 'contract years drawn as rows of squares');
  check(await page.locator('#ct-schedule-table tbody tr').count() === 3 && (await page.textContent('#ct-schedule .card-t')) === 'Next invoice: US$466,400 on 1 Oct 2027' && (await page.locator('#ct-schedule-table tbody tr').first().textContent()).includes('Current'), 'contract years: 3 rows, year 1 current, next invoice 466,400 on 1 Oct 2027');
  check((await page.textContent('#ct-schedule .card-s')).includes('US$999,200 still to be invoiced'), 'still to be invoiced after today: 466,400 + 532,800');
  check(await page.locator('#ct-dates tbody tr').count() === 3 && await page.locator('#ct-dates tbody tr.ended').count() === 1, 'key dates: 3, one passed');
  check(await page.getAttribute('[data-kpi="ct-next"] .kpi-v', 'data-value') === '2027-07-03' && (await page.textContent('[data-kpi="ct-next"]')).includes('Opens in 237 days'), 'next key date: endpoint-count window opens 3 Jul 2027 (in 237 days)');
  check(await page.locator('.mstats .kpi').count() === 6, 'six figures in the stats strip above the mosaic');
  await page.evaluate(() => window.BudgetTracker.go('c-contoso')); await page.waitForTimeout(100);
  check(await page.locator('[data-kpi="ct-term"]').count() === 0, 'monthly contract shows no term end');

  await nav('c-proseware');
  check(await page.locator('#ct-single').count() === 1 && await page.locator('#ct-bars').count() === 0 && await page.locator('#ct-includes li').count() === 5, 'one-fee contract: summary card with the 5 included modules instead of a single bar');
  check(await kpiVal('ct-annual') === 126000 && Math.abs(await kpiVal('ct-gap') - 2000) < 0.01, 'one-fee contract: 126,000 a year, 2,000 below the 128,000 budget');

  console.log('Encoding');
  await loadFile(EX('examples/utf8-names.csv'), 'utf8-names.csv');
  check(JSON.stringify(await S(() => window.BudgetTracker.S.rows.map((r) => r[2]))) === '["Zürich","Genève","Malmö"]', 'UTF-8 names (Zürich, Genève, Malmö) are read correctly');
  check(await total() === 6000, '€-prefixed amounts parse: total 6,000');

  console.log('Pivot-table export (Mac Roman, title row, subtotals, fill-down, dashes)');
  await loadFile(EX('examples/pivot-export-macroman.csv'), 'pivot-export-macroman.csv');
  check(await total() === 159169, 'subtotal and grand-total rows removed: total 159,169 (not double counted)');
  check(await S(() => window.BudgetTracker.S.rows.length) === 10, '10 line rows kept');
  check(await S(() => window.BudgetTracker.S.fileInfo[0].encoding) === 'Mac Roman', 'encoding detected as Mac Roman');
  check(JSON.stringify(await S(() => { const s = window.BudgetTracker.S, v = s.map.vendor; return [...new Set(s.rows.map((r) => r[v]))]; })) === JSON.stringify(['1000 - Dummy', 'Northwind Software', 'Fabrikam Sàrl', 'Contoso Cloud', 'Wingtip Zürich AG']), 'vendor labels filled down; Sàrl / Zürich decoded correctly');
  check(await mapped('category') === 'Reporting Category', '"Reporting Category, Licences" title row becomes a column');
  const flags = await S(() => { const c = {}; for (const r of window.BudgetTracker.S.recs) for (const f of r.flags) c[f] = (c[f] || 0) + 1; return c; });
  check(flags.vendor_placeholder === 4 && flags.open_question === 2 && flags.amount_zero === 1 && !flags.amount_bad, `checks: 4 placeholder-vendor lines, 2 open questions, 1 zero ("-") amount, no parse errors (${JSON.stringify(flags)})`);
  await nav('source');
  check((await page.textContent('#file-table')).includes('Yes'), 'Data source confirms the lines add up to the file\'s grand total');
  await shot('32-pivot-source', false);

  console.log('Hand-cleaned sheet (amount first, capability, tool names, reviewer notes)');
  await loadFile(EX('examples/cleaned-sheet.csv'), 'cleaned-sheet.csv');
  await page.waitForFunction(() => location.hash === '#/map');
  check(await mapped('amount') === 'Sum of Total in USD' && await mapped('capability') === 'Capability' && await mapped('vendor') === 'Vendor', 'amount / capability / vendor detected; opens on the Spend map');
  check(await total() === 110720, 'total 110,720');
  const f2 = await S(() => { const c = {}; for (const r of window.BudgetTracker.S.recs) for (const f of r.flags) c[f] = (c[f] || 0) + 1; return c; });
  await page.waitForSelector('#tm-map .gh');
  check((await page.locator('#tm-map .gh text').first().textContent()).startsWith('Sales'), 'map leads with the largest capability from the file: Sales');
  check((await page.textContent('#map-mode [data-k="dept"]')) === 'Capability', 'map groups by the file\'s own Capability column');
  check(f2.open_question === 2 && f2.vendor_placeholder === 1 && f2.unclassified_value === 1, `reviewer notes flagged: "unclear" + "double?" = 2 open questions, "Varied" vendor, "Unknown" capability (${JSON.stringify(f2)})`);

  console.log('EU finance export');
  await loadFile(EX('examples/finance-export-eu.csv'), 'finance-export-eu.csv');
  check(await total() === 5517000, 'total 5,517,000');
  check(await mapped('amount') === 'Budget FY2027' && await mapped('prior') === 'Budget FY2026', 'amount / prior = Budget FY2027 / FY2026');
  check(await mapped('renewal') === 'Contract end', 'renewal → Contract end');
  check(await S(() => window.BudgetTracker.S.months.filter((c) => c != null).length) === 12, '12 month columns');

  console.log('Minimal file (3 columns)');
  await loadFile(EX('examples/minimal-us.csv'), 'minimal-us.csv');
  check(await total() === 5517000, 'total = 5,517,000');
  check((await page.getAttribute('#nav-yoy', 'class')).includes('muted'), 'year-over-year nav item muted (no prior-year column)');
  await nav('yoy');
  check(await page.isVisible('#goto-source'), 'year-over-year page explains what is missing and links to mapping');
  await nav('c-contoso');
  check(await kpiVal('ct-budget') === 758000 && await page.textContent('[data-kpi="ct-gap"] .kpi-v') === '—' && (await page.textContent('[data-kpi="ct-gap"]')).includes('Needs an exchange rate'), 'EUR invoice vs USD budget with no rate: asks for an exchange rate instead of guessing');
  await nav('c-fabrikam');
  check(Math.abs(await kpiVal('ct-gap') + 25400) < 0.01 && (await page.textContent('[data-kpi="ct-gap"] .kpi-l')).includes('over budget'), 'USD invoice vs USD budget: 466,400 run-rate is 25,400 over the 441,000 budget');
  await shot('31-minimal-contract');

  console.log('Mapping');
  await loadFile(EX('sample-budget.csv'), 'sample-budget.csv');
  await nav('source');
  const priorCol = await S(() => window.BudgetTracker.S.headers.indexOf('prior_year_budget'));
  await page.selectOption('#map-amount', String(priorCol));
  await page.selectOption('#map-prior', '');
  await page.click('#map-apply');
  await nav('map');
  check(await total() === 5214500 && await page.getAttribute('#map-total', 'data-value') === '5214500', 'amount switched to prior_year_budget → 5,214,500');
  await nav('source');
  await page.click('#map-reset'); await page.click('#map-apply');
  await nav('map');
  check(await total() === 5517000, 're-detect restores annual_budget');

  console.log('Layout');
  await page.evaluate(() => window.BudgetTracker.loadSample());
  await page.waitForFunction(() => location.hash === '#/map');
  await page.setViewportSize({ width:390, height:844 });
  const overflow = () => S(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelector('#main').scrollWidth - document.querySelector('#main').clientWidth));
  let over = await overflow();
  check(over <= 0, `no horizontal scroll at 390px on the Spend map (overflow ${over}px)`);
  await page.evaluate(() => window.BudgetTracker.go('c-fabrikam')); await page.waitForTimeout(100);
  over = await overflow();
  check(over <= 0, `no horizontal scroll at 390px on a contract page (overflow ${over}px)`);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-41-phone-contract.png'), fullPage:true });
  await page.evaluate(() => window.BudgetTracker.go('app/' + encodeURIComponent('Northwind Software'))); await page.waitForTimeout(150);
  over = await overflow();
  check(over <= 0, `no horizontal scroll at 390px on an application page (overflow ${over}px)`);
  await page.evaluate(() => window.BudgetTracker.go('map')); await page.waitForTimeout(100);
  if (shots) await page.screenshot({ path:path.join(shots, 'ex-40-phone.png') });
  await page.click('#nav-toggle');
  await page.waitForTimeout(300);
  check(await page.isVisible('#nav-map'), 'hamburger opens the side panel on phones');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width:1440, height:900 });
  await page.emulateMedia({ colorScheme:'dark' });
  await page.evaluate(() => window.BudgetTracker.go('c-contoso')); await page.waitForTimeout(100);
  await shot('42-dark-contract');

  console.log('Curated build: data-upload="off"');
  const fs = require('fs'), os = require('os');
  const tmp = path.join(os.tmpdir(), 'tracker-upload-off.html');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(ROOT, 'explorer', 'corporate-it-budget-tracker.html'), 'utf8').replace('<script type="text/plain" id="sample-csv">', '<script type="text/plain" id="sample-csv" data-upload="off" data-autoload="true">'));
  const p2 = await browser.newPage({ viewport:{ width:1440, height:900 } });
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto('file://' + tmp);
  await p2.waitForFunction(() => window.BudgetTracker.S.loaded && location.hash === '#/map');
  check(!(await p2.isVisible('#tb-load')) && await p2.evaluate(() => window.BudgetTracker.UPLOAD) === false, 'no Load CSV button; opens straight on the Spend map');
  await p2.click('#nav-source');
  await p2.waitForFunction(() => window.BudgetTracker.S.page === 'source');
  check(await p2.locator('text=Replace…').count() === 0 && await p2.locator('#file-table').count() === 1, 'Data source has no Replace / Sample data buttons');
  await p2.close();

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
