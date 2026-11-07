#!/usr/bin/env python3
"""Generate the fictional sample budget and the blank template.

    python3 scripts/make_sample_data.py

Writes data/sample-budget.csv always, and data/sample-budget.xlsx and
data/budget-template.xlsx when openpyxl is installed (it is only needed here,
not by build_data.py). All vendors and figures are invented.
"""
from __future__ import annotations

import csv
import datetime as dt
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BUDGET_YEAR = 2027
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
COLUMNS = [
    "line_id", "vendor", "product_or_service", "category", "cost_pool", "tower", "cost_centre", "owner",
    "annual_budget", "currency", "capex_opex", "contract_start", "contract_end", "renewal_date", "auto_renew",
    "notice_period_days", "billing_frequency", "licence_qty", "unit_price", "prior_year_budget",
] + MONTHS + ["notes"]

# vendor, product, category, cost_pool, tower, cost_centre, owner, budget, licence_qty, capex_opex, billing
CATALOG = [
    ("Northwind Software", "Office productivity suite", "Licence", "Software", "End user", "IT-Workplace", "Head of Workplace", 486000, 1800, "OPEX", "Annual"),
    ("Northwind Software", "Server & database licences", "Licence", "Software", "Infrastructure", "IT-Infra", "Head of Infrastructure", 212000, 64, "OPEX", "Annual"),
    ("Northwind Software", "Enterprise support agreement", "Contract", "Outside services", "Infrastructure", "IT-Infra", "Head of Infrastructure", 95000, None, "OPEX", "Annual"),
    ("Contoso Cloud", "IaaS compute & storage commitment", "Contract", "Cloud services", "Infrastructure", "IT-Infra", "Head of Infrastructure", 640000, None, "OPEX", "Monthly"),
    ("Contoso Cloud", "Managed Kubernetes platform", "Service", "Cloud services", "Application", "IT-Apps", "Head of Applications", 118000, None, "OPEX", "Monthly"),
    ("Fabrikam Security", "Endpoint detection & response", "Licence", "Software", "Security", "IT-Security", "CISO", 156000, 2100, "OPEX", "Annual"),
    ("Fabrikam Security", "Managed SOC service", "Service", "Outside services", "Security", "IT-Security", "CISO", 240000, None, "OPEX", "Quarterly"),
    ("Fabrikam Security", "Annual penetration testing", "Service", "Outside services", "Security", "IT-Security", "CISO", 45000, None, "OPEX", "One-off"),
    ("Tailspin Networks", "SD-WAN service (32 sites)", "Service", "Telecom", "Network", "IT-Infra", "Network Manager", 210000, None, "OPEX", "Monthly"),
    ("Tailspin Networks", "Core switch maintenance", "Contract", "Hardware maintenance", "Network", "IT-Infra", "Network Manager", 38000, None, "OPEX", "Annual"),
    ("Tailspin Networks", "Campus Wi-Fi refresh", "Contract", "Hardware", "Network", "IT-Infra", "Network Manager", 180000, None, "CAPEX", "One-off"),
    ("Wingtip Telecom", "Mobile voice & data plans", "Service", "Telecom", "End user", "IT-Workplace", "Head of Workplace", 132000, 950, "OPEX", "Monthly"),
    ("Wingtip Telecom", "Internet transit & MPLS", "Contract", "Telecom", "Network", "IT-Infra", "Network Manager", 88000, None, "OPEX", "Monthly"),
    ("Adatum Analytics", "BI platform licences", "Licence", "Software", "Data", "IT-Data", "Head of Data", 74000, 420, "OPEX", "Annual"),
    ("Adatum Analytics", "Data warehouse consumption", "Service", "Cloud services", "Data", "IT-Data", "Head of Data", 165000, None, "OPEX", "Monthly"),
    ("Litware Collaboration", "Video conferencing rooms", "Licence", "Software", "End user", "IT-Workplace", "Head of Workplace", 42000, 60, "OPEX", "Annual"),
    ("Litware Collaboration", "Team chat enterprise plan", "Licence", "Software", "End user", "IT-Workplace", "", 58000, 1800, "OPEX", "Annual"),
    ("Proseware HR", "HR & payroll SaaS", "Licence", "Software", "Application", "IT-Apps", "Head of Applications", 128000, 2000, "OPEX", "Annual"),
    ("Woodgrove Finance Apps", "ERP subscription", "Licence", "Software", "Application", "IT-Apps", "Head of Applications", 395000, 350, "OPEX", "Annual"),
    ("Woodgrove Finance Apps", "ERP implementation partner", "Service", "Outside services", "Application", "IT-Apps", "Head of Applications", 220000, None, "OPEX", "Monthly"),
    ("Woodgrove Finance Apps", "ERP premium support", "Contract", "Outside services", "Application", "IT-Apps", "Head of Applications", 61000, None, "OPEX", "Annual"),
    ("Coho Hardware Services", "Laptop fleet maintenance", "Contract", "Hardware maintenance", "End user", "IT-Workplace", "Head of Workplace", 76000, None, "OPEX", "Annual"),
    ("Coho Hardware Services", "Laptop refresh (25% of fleet)", "Contract", "Hardware", "End user", "IT-Workplace", "Head of Workplace", 310000, None, "CAPEX", "One-off"),
    ("Coho Hardware Services", "Printer managed service", "Service", "Outside services", "End user", "", "", 24000, None, "OPEX", "Quarterly"),
    ("Fourth Coffee Consulting", "IT service desk (outsourced)", "Service", "Outside services", "End user", "IT-Workplace", "Head of Workplace", 360000, None, "OPEX", "Monthly"),
    ("Fourth Coffee Consulting", "Architecture advisory retainer", "Service", "Outside services", "Application", "IT-Apps", "CIO Office", 48000, None, "OPEX", "Quarterly"),
    ("Relecloud Hosting", "Colocation (2 racks)", "Contract", "Outside services", "Infrastructure", "IT-Infra", "Head of Infrastructure", 72000, None, "OPEX", "Monthly"),
    ("Relecloud Hosting", "Disaster recovery site", "Service", "Cloud services", "Infrastructure", "IT-Infra", "Head of Infrastructure", 96000, None, "OPEX", "Monthly"),
    ("VanArsdel Monitoring", "APM & observability platform", "Licence", "Software", "Infrastructure", "IT-Infra", "Head of Infrastructure", 138000, None, "OPEX", "Annual"),
    ("VanArsdel Monitoring", "Log management ingestion", "Service", "Cloud services", "Infrastructure", "IT-Infra", "Head of Infrastructure", 54000, None, "OPEX", "Monthly"),
    ("Lamna Backup", "Backup & recovery licences", "Licence", "Software", "Infrastructure", "IT-Infra", "Head of Infrastructure", 67000, None, "OPEX", "Annual"),
    ("Trey Research", "Analyst research subscription", "Licence", "Outside services", "Application", "IT-Apps", "CIO Office", 39000, 3, "OPEX", "Annual"),
    ("Graphic Design Institute", "Design software seats", "Licence", "Software", "End user", "IT-Workplace", "", 26000, 40, "OPEX", "Annual"),
    ("Alpine Identity", "Identity & access management", "Licence", "Software", "Security", "IT-Security", "CISO", 112000, 2100, "OPEX", "Annual"),
    ("Alpine Identity", "Privileged access management", "Licence", "Software", "Security", "IT-Security", "CISO", 48000, 80, "OPEX", "Annual"),
    ("Humongous Code", "Developer tooling & CI seats", "Licence", "Software", "Application", "IT-Apps", "Head of Applications", 52000, 160, "OPEX", "Annual"),
    ("Humongous Code", "Source code security scanning", "Licence", "Software", "Security", "IT-Security", "CISO", 34000, 160, "OPEX", "Annual"),
    ("Datum Contact Centre", "Contact centre platform", "Licence", "Software", "Application", "IT-Apps", "Head of Applications", 142000, 180, "OPEX", "Annual"),
    ("Lucerne Legal Tech", "Contract management system", "Licence", "Software", "Application", "IT-Apps", "Head of Applications", 36000, 60, "OPEX", "Annual"),
    # cancelled for the budget year: budget 0, prior year > 0 (shows as "Removed" in the year-over-year bridge)
    ("Litware Collaboration", "Legacy phone system maintenance", "Contract", "Hardware maintenance", "Network", "IT-Infra", "Network Manager", 0, None, "OPEX", "Annual"),
    ("Tailspin Networks", "Legacy firewall support", "Contract", "Hardware maintenance", "Security", "IT-Security", "CISO", 0, None, "OPEX", "Annual"),
]
NEW_LINES = {"Managed Kubernetes platform", "Privileged access management", "Source code security scanning",
             "Campus Wi-Fi refresh"}
REMOVED_PRIOR = {"Legacy phone system maintenance": 41000, "Legacy firewall support": 22000}
# fixed renewal dates/notice periods so the sample always shows every urgency band (as of early Nov 2026)
OVERRIDES = {
    "Managed SOC service": ("2026-12-31", 90),          # notice deadline already passed
    "Endpoint detection & response": ("2027-01-31", 60),  # deadline within 30 days
    "ERP subscription": ("2027-03-31", 90),             # deadline within 60 days
    "Office productivity suite": ("2027-03-01", 30),    # deadline within 90 days
    "Backup & recovery licences": ("2026-09-30", 60),   # renewal date in the past: validation warning
}
NOTES = {
    "Team chat enterprise plan": "Owner left the company; needs reassignment.",
    "Laptop refresh (25% of fleet)": "Phased with the 4-year device lifecycle.",
    "IaaS compute & storage commitment": "3-year commit; true-up in Q4.",
}


def generate() -> list[dict]:
    rng = random.Random(BUDGET_YEAR)
    rows = []
    for n, (vendor, product, cat, pool, tower, cc, owner, budget, qty, capex, billing) in enumerate(CATALOG, 1):
        row = dict.fromkeys(COLUMNS, "")
        row.update(line_id=f"IT-{n:03d}", vendor=vendor, product_or_service=product, category=cat, cost_pool=pool,
                   tower=tower, cost_centre=cc, owner=owner, annual_budget=budget, currency="EUR",
                   capex_opex=capex, billing_frequency=billing, notes=NOTES.get(product, ""))
        if qty:
            row["licence_qty"] = qty
            unit = round(budget / qty, 2)
            row["unit_price"] = 30 if product == "Team chat enterprise plan" else unit  # one deliberate mismatch
        if product in REMOVED_PRIOR:
            row["prior_year_budget"] = REMOVED_PRIOR[product]
            row["notes"] = "Cancelled: not renewing."
        elif product not in NEW_LINES:
            row["prior_year_budget"] = round(budget / (1 + rng.uniform(-0.12, 0.18)) / 500) * 500

        if billing != "One-off" and budget > 0:
            if product in OVERRIDES:
                renewal, notice = OVERRIDES[product]
                renewal = dt.date.fromisoformat(renewal)
            else:
                renewal = dt.date(2026, 11, 20) + dt.timedelta(days=rng.randint(0, 390))
                notice = rng.choice([30, 60, 90] if cat != "Service" else [30, 60])
            term = rng.choice([1, 1, 2, 3])
            end = renewal - dt.timedelta(days=1)
            row.update(renewal_date=renewal, contract_end=end,
                       contract_start=end.replace(year=end.year - term) + dt.timedelta(days=1),
                       notice_period_days=notice, auto_renew="N" if rng.random() < 0.25 else "Y")

        # monthly phasing where cash timing is known; other rows are spread evenly by build_data.py
        months = None
        if billing == "Quarterly":
            months = {m: budget / 4 for m in ("jan", "apr", "jul", "oct")}
        elif billing == "One-off" and budget:
            months = {MONTHS[rng.randint(1, 9)]: budget}
        elif billing == "Annual" and budget and row["renewal_date"] and row["renewal_date"].year == BUDGET_YEAR:
            months = {MONTHS[row["renewal_date"].month - 1]: budget}
        if months:
            for m in MONTHS:
                row[m] = round(months.get(m, 0), 2)
        rows.append(row)
    return rows


def write_csv(rows, path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: (v.isoformat() if isinstance(v, dt.date) else v) for k, v in r.items()})


FIELD_HELP = [
    ("line_id", "Required", "Unique ID for the line, e.g. IT-001."),
    ("vendor", "Required", "Supplier name, spelled consistently."),
    ("product_or_service", "Required", "What is being bought."),
    ("category", "Required", "Licence, Service or Contract."),
    ("cost_pool", "Required", "What was bought (TBM-style): Software, Cloud services, Outside services, Telecom, Hardware, Hardware maintenance."),
    ("tower", "Optional", "Technical function: End user, Application, Infrastructure, Network, Security, Data."),
    ("cost_centre", "Recommended", "Finance cost centre code. Blank = unallocated."),
    ("owner", "Recommended", "Accountable budget owner (role is fine). Blank = unowned."),
    ("annual_budget", "Required", "Budget for the budget year, plain number, reporting currency, excl. VAT. Use 0 for lines being cancelled."),
    ("currency", "Required", "ISO code, e.g. EUR. One currency per file."),
    ("capex_opex", "Optional", "CAPEX or OPEX."),
    ("contract_start / contract_end", "Optional", "Dates (Excel date or YYYY-MM-DD)."),
    ("renewal_date", "Optional", "Next renewal date. Drives the renewals timeline."),
    ("auto_renew", "Optional", "Y or N."),
    ("notice_period_days", "Optional", "Days before renewal by which notice must be given."),
    ("billing_frequency", "Optional", "Monthly, Quarterly, Annual, One-off."),
    ("licence_qty / unit_price", "Optional", "Seats and price per seat; checked against annual_budget."),
    ("prior_year_budget", "Optional", "Current-year budget for comparison. Blank = new spend."),
    ("jan … dec", "Optional", "Monthly cash phasing. Leave all blank to spread evenly."),
    ("notes", "Optional", "Free text."),
]


def write_xlsx(rows, path: Path, template: bool = False) -> bool:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill
        from openpyxl.worksheet.datavalidation import DataValidation
    except ImportError:
        print(f"  (openpyxl not installed; skipped {path.name})")
        return False
    wb = Workbook()
    ws = wb.active
    ws.title = "Budget"
    ws.append(COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1F4E79")
    for r in rows:
        ws.append([r[c] if r[c] != "" else None for c in COLUMNS])
    for col in ("L", "M", "N"):  # contract_start, contract_end, renewal_date
        for cell in ws[col][1:]:
            cell.number_format = "yyyy-mm-dd"
    for col_cells in ws.columns:
        ws.column_dimensions[col_cells[0].column_letter].width = max(10, min(34, len(str(col_cells[0].value)) + 4))
    ws.freeze_panes = "C2"
    dv = DataValidation(type="list", formula1='"Licence,Service,Contract"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add("D2:D2000")
    yn = DataValidation(type="list", formula1='"Y,N"', allow_blank=True)
    ws.add_data_validation(yn)
    yn.add("O2:O2000")
    help_ws = wb.create_sheet("Instructions")
    help_ws.append(["Column", "Status", "Meaning"])
    for cell in help_ws[1]:
        cell.font = Font(bold=True)
    for item in FIELD_HELP:
        help_ws.append(list(item))
    help_ws.column_dimensions["A"].width = 30
    help_ws.column_dimensions["C"].width = 100
    if template:
        help_ws.append([])
        help_ws.append(["Keep the sheet name 'Budget' and the header row unchanged. One row per budget line."])
    wb.save(path)
    return True


def main() -> None:
    DATA.mkdir(exist_ok=True)
    rows = generate()
    write_csv(rows, DATA / "sample-budget.csv")
    print(f"wrote {DATA / 'sample-budget.csv'} ({len(rows)} lines)")
    if write_xlsx(rows, DATA / "sample-budget.xlsx"):
        print(f"wrote {DATA / 'sample-budget.xlsx'}")
    if write_xlsx([], DATA / "budget-template.xlsx", template=True):
        print(f"wrote {DATA / 'budget-template.xlsx'}")


if __name__ == "__main__":
    main()
