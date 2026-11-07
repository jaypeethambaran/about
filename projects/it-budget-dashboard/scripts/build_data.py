#!/usr/bin/env python3
"""Validate an IT budget spreadsheet (.xlsx or .csv) and build site/data.js.

Uses the Python standard library only, so it runs on locked-down machines
without any `pip install`.

    python3 scripts/build_data.py data/sample-budget.xlsx
    python3 scripts/build_data.py my-budget.csv --year 2027 --as-of 2026-11-07

Outputs:
    site/data.js                    data for the dashboard (only written if there are no errors)
    reports/validation-report.md    human-readable list of errors and warnings

Exit code 0 = built (warnings allowed), 1 = blocking errors, 2 = bad arguments/file.
See docs/data-schema.md for the column contract.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
FULL_MONTHS = {
    "january": "jan", "february": "feb", "march": "mar", "april": "apr", "june": "jun",
    "july": "jul", "august": "aug", "september": "sep", "sept": "sep", "october": "oct",
    "november": "nov", "december": "dec",
}
CATEGORIES = ["Licence", "Service", "Contract"]
CATEGORY_ALIASES = {
    "licence": "Licence", "license": "Licence", "licences": "Licence", "licenses": "Licence",
    "service": "Service", "services": "Service",
    "contract": "Contract", "contracts": "Contract",
}
REQUIRED = ["line_id", "vendor", "product_or_service", "category", "cost_pool", "annual_budget", "currency"]
RECOMMENDED = ["owner", "cost_centre"]
OPTIONAL = [
    "tower", "capex_opex", "contract_start", "contract_end", "renewal_date", "auto_renew",
    "notice_period_days", "billing_frequency", "licence_qty", "unit_price", "prior_year_budget", "notes",
]
KNOWN = set(REQUIRED + RECOMMENDED + OPTIONAL + MONTHS)
DATE_FIELDS = ["contract_start", "contract_end", "renewal_date"]
HEADER_ALIASES = {
    "product": "product_or_service", "service": "product_or_service", "description": "product_or_service",
    "budget": "annual_budget", "cost_center": "cost_centre", "license_qty": "licence_qty",
    "prior_year": "prior_year_budget", "notice_period": "notice_period_days", "id": "line_id",
}

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_REL_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
EXCEL_EPOCH = dt.date(1899, 12, 30)


# --------------------------------------------------------------------------- reading


def normalize_header(h) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", str(h or "").strip().lower()).strip("_")
    key = FULL_MONTHS.get(key, key)
    return HEADER_ALIASES.get(key, key)


def _col_index(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path: Path, sheet: str | None = None) -> list[list]:
    """Minimal .xlsx reader: first sheet called 'Budget' (or `sheet`), else the first sheet."""
    m = f"{{{NS_MAIN}}}"
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels.iter(f"{{{NS_REL_PKG}}}Relationship")}
        sheets = [(s.get("name"), targets[s.get(f"{{{NS_REL_DOC}}}id")]) for s in wb.iter(f"{m}sheet")]
        if not sheets:
            raise ValueError("workbook has no sheets")
        wanted = (sheet or "budget").lower()
        name, target = next((s for s in sheets if s[0].lower() == wanted), sheets[0])
        if sheet and name.lower() != wanted:
            raise ValueError(f"sheet '{sheet}' not found (sheets: {', '.join(s[0] for s in sheets)})")
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target

        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(f"{m}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{m}t")))

        rows: list[list] = []
        for row in ET.fromstring(z.read(target)).iter(f"{m}row"):
            cells: dict[int, object] = {}
            for pos, c in enumerate(row.iter(f"{m}c")):
                col = _col_index(c.get("r")) if c.get("r") else pos
                t, v = c.get("t"), c.find(f"{m}v")
                if t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(f"{m}t"))
                elif v is None or v.text is None:
                    val = None
                elif t == "s":
                    val = shared[int(v.text)]
                elif t == "b":
                    val = v.text == "1"
                elif t in ("str", "e"):
                    val = v.text
                else:
                    val = float(v.text)
                cells[col] = val
            width = max(cells) + 1 if cells else 0
            rows.append([cells.get(i) for i in range(width)])
    return rows


def read_csv(path: Path) -> list[list]:
    text = path.read_text(encoding="utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=",;\t")
    except (csv.Error, IndexError):
        dialect = csv.excel
    return [row for row in csv.reader(text.splitlines(), dialect)]


def read_rows(path: Path, sheet: str | None = None) -> list[list]:
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        return read_xlsx(path, sheet)
    if suffix in (".csv", ".txt"):
        return read_csv(path)
    raise ValueError(f"unsupported file type '{suffix}' (use .xlsx or .csv; save .xls as .xlsx first)")


# --------------------------------------------------------------------------- parsing


def is_blank(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def text(v) -> str:
    if is_blank(v):
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def parse_number(v):
    """Return float, None for blank, or raise ValueError. Accepts '1,234.50', '€ 1 234', '12%'-free numbers."""
    if is_blank(v):
        return None
    if isinstance(v, bool):
        raise ValueError(v)
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[\s €$£]|EUR|USD|GBP", "", str(v))
    s = s.replace(",", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return float(s)


def parse_date(v):
    """Return ISO date string, None for blank, or raise ValueError. Accepts Excel serials and YYYY-MM-DD."""
    if is_blank(v):
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return (EXCEL_EPOCH + dt.timedelta(days=int(v))).isoformat()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(s)


def parse_bool(v):
    if is_blank(v):
        return None
    if isinstance(v, bool):
        return v
    s = text(v).lower()
    if s in ("y", "yes", "true", "1", "x"):
        return True
    if s in ("n", "no", "false", "0"):
        return False
    raise ValueError(s)


# --------------------------------------------------------------------------- building


def build(rows: list[list], *, as_of: dt.date, budget_year: int, source: str = "", sha256: str = "") -> dict:
    """Turn raw rows (first row = headers) into the dashboard payload. Never raises on bad data:
    problems are returned in payload['issues'] with level 'error' or 'warning'."""
    issues: list[dict] = []

    def issue(level, message, row=None, line_id=None, field=None):
        issues.append({"level": level, "row": row, "line_id": line_id, "field": field, "message": message})

    # skip leading blank rows; first non-blank row is the header
    while rows and all(is_blank(c) for c in rows[0]):
        rows = rows[1:]
    if not rows:
        issue("error", "The sheet is empty.")
        return _payload([], issues, as_of, budget_year, source, sha256, "")

    header = [normalize_header(h) for h in rows[0]]
    missing = [c for c in REQUIRED if c not in header]
    for col in missing:
        issue("error", f"Required column '{col}' is missing.", field=col)
    for col in RECOMMENDED:
        if col not in header:
            issue("warning", f"Recommended column '{col}' is missing; ownership metrics will be empty.", field=col)
    unknown = [h for h in header if h and h not in KNOWN]
    if unknown:
        issue("warning", f"Ignored unknown columns: {', '.join(unknown)}.")
    if missing:
        return _payload([], issues, as_of, budget_year, source, sha256, "")

    lines: list[dict] = []
    seen_ids: dict[str, int] = {}
    currencies: set[str] = set()

    for rownum, raw in enumerate(rows[1:], start=2):
        rec = {h: (raw[i] if i < len(raw) else None) for i, h in enumerate(header) if h}
        if all(is_blank(v) for v in rec.values()):
            continue
        lid = text(rec.get("line_id")) or f"row-{rownum}"

        def err(msg, field=None):
            issue("error", msg, rownum, lid, field)

        def warn(msg, field=None):
            issue("warning", msg, rownum, lid, field)

        for col in REQUIRED:
            if is_blank(rec.get(col)):
                err(f"'{col}' is blank.", col)

        if lid in seen_ids:
            err(f"Duplicate line_id (also on row {seen_ids[lid]}).", "line_id")
        seen_ids.setdefault(lid, rownum)

        cat_raw = text(rec.get("category"))
        category = CATEGORY_ALIASES.get(cat_raw.lower())
        if cat_raw and not category:
            err(f"Category '{cat_raw}' is not one of {', '.join(CATEGORIES)}.", "category")

        nums = {}
        for col in ["annual_budget", "prior_year_budget", "licence_qty", "unit_price", "notice_period_days"] + MONTHS:
            try:
                nums[col] = parse_number(rec.get(col))
            except ValueError:
                nums[col] = None
                (err if col == "annual_budget" else warn)(f"'{col}' is not a number: '{text(rec.get(col))}'.", col)
        budget = nums["annual_budget"]
        if budget is not None and budget < 0:
            err("'annual_budget' is negative.", "annual_budget")

        dates = {}
        for col in DATE_FIELDS:
            try:
                dates[col] = parse_date(rec.get(col))
            except ValueError:
                dates[col] = None
                err(f"'{col}' is not a date (use YYYY-MM-DD or an Excel date): '{text(rec.get(col))}'.", col)

        try:
            auto_renew = parse_bool(rec.get("auto_renew"))
        except ValueError:
            auto_renew = None
            warn(f"'auto_renew' should be Y or N, got '{text(rec.get('auto_renew'))}'.", "auto_renew")

        currency = text(rec.get("currency")).upper()
        if currency:
            currencies.add(currency)

        capex_opex = text(rec.get("capex_opex")).upper()
        if capex_opex and capex_opex not in ("CAPEX", "OPEX"):
            warn(f"'capex_opex' should be CAPEX or OPEX, got '{capex_opex}'.", "capex_opex")
            capex_opex = ""

        owner, cost_centre = text(rec.get("owner")), text(rec.get("cost_centre"))
        if "owner" in header and not owner:
            warn("No owner.", "owner")
        if "cost_centre" in header and not cost_centre:
            warn("No cost centre.", "cost_centre")

        # contract sanity
        if dates["contract_start"] and dates["contract_end"] and dates["contract_end"] < dates["contract_start"]:
            warn("contract_end is before contract_start.", "contract_end")
        if dates["renewal_date"] and dates["renewal_date"] < as_of.isoformat() and (budget or 0) > 0:
            warn(f"Renewal date {dates['renewal_date']} has passed; update it or confirm the renewal.", "renewal_date")
        if auto_renew and dates["renewal_date"] and nums["notice_period_days"] is None:
            warn("Auto-renews but notice_period_days is blank, so the cancellation deadline is unknown.",
                 "notice_period_days")

        qty, unit = nums["licence_qty"], nums["unit_price"]
        if qty and unit and budget:
            implied = qty * unit
            if abs(implied - budget) > max(1.0, 0.02 * budget):
                warn(f"licence_qty × unit_price = {implied:,.0f} but annual_budget = {budget:,.0f}.", "unit_price")

        # monthly phasing: use provided months, otherwise spread evenly (flagged as derived)
        provided = [nums[mn] for mn in MONTHS]
        if any(v is not None for v in provided):
            monthly = [v or 0.0 for v in provided]
            derived = False
            if budget is not None and abs(sum(monthly) - budget) > max(1.0, 0.005 * budget):
                warn(f"Monthly phasing sums to {sum(monthly):,.0f}, not the annual_budget {budget:,.0f}.", "jan")
        else:
            monthly = [round((budget or 0) / 12, 2)] * 12
            derived = True

        notice_deadline = None
        if dates["renewal_date"]:
            days = int(nums["notice_period_days"] or 0)
            notice_deadline = (dt.date.fromisoformat(dates["renewal_date"]) - dt.timedelta(days=days)).isoformat()

        lines.append({
            "line_id": lid,
            "vendor": text(rec.get("vendor")),
            "product_or_service": text(rec.get("product_or_service")),
            "category": category or cat_raw,
            "cost_pool": text(rec.get("cost_pool")),
            "tower": text(rec.get("tower")),
            "cost_centre": cost_centre,
            "owner": owner,
            "annual_budget": budget or 0.0,
            "currency": currency,
            "capex_opex": capex_opex,
            "contract_start": dates["contract_start"],
            "contract_end": dates["contract_end"],
            "renewal_date": dates["renewal_date"],
            "auto_renew": auto_renew,
            "notice_period_days": int(nums["notice_period_days"]) if nums["notice_period_days"] is not None else None,
            "notice_deadline": notice_deadline,
            "billing_frequency": text(rec.get("billing_frequency")),
            "licence_qty": qty,
            "unit_price": unit,
            "prior_year_budget": nums["prior_year_budget"],
            "monthly": monthly,
            "monthly_derived": derived,
            "notes": text(rec.get("notes")),
            "row": rownum,
        })

    if not lines and not any(i["level"] == "error" for i in issues):
        issue("error", "No data rows found under the header row.")
    if len(currencies) > 1:
        issue("error", f"Mixed currencies ({', '.join(sorted(currencies))}). The prototype needs one reporting "
                       "currency; convert before importing.", field="currency")
    currency = next(iter(currencies)) if len(currencies) == 1 else ""
    return _payload(lines, issues, as_of, budget_year, source, sha256, currency)


def _payload(lines, issues, as_of, budget_year, source, sha256, currency) -> dict:
    return {
        "meta": {
            "source_file": source,
            "source_sha256": sha256,
            "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "as_of": as_of.isoformat(),
            "budget_year": budget_year,
            "currency": currency,
            "line_count": len(lines),
            "total_budget": round(sum(l["annual_budget"] for l in lines), 2),
            "error_count": sum(i["level"] == "error" for i in issues),
            "warning_count": sum(i["level"] == "warning" for i in issues),
        },
        "issues": issues,
        "lines": lines,
    }


# --------------------------------------------------------------------------- output


def write_data_js(payload: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    parts = [
        "// Generated by scripts/build_data.py. Do not edit by hand: change the spreadsheet and rebuild.",
        "window.BUDGET_DATA = {",
        f'"meta":{dump(payload["meta"])},',
        '"issues":[',
        ",\n".join(dump(i) for i in payload["issues"]),
        "],",
        '"lines":[',
        ",\n".join(dump(l) for l in payload["lines"]),
        "]};",
        "",
    ]
    out.write_text("\n".join(parts), encoding="utf-8")


def render_report(payload: dict) -> str:
    m = payload["meta"]
    errors = [i for i in payload["issues"] if i["level"] == "error"]
    warnings = [i for i in payload["issues"] if i["level"] == "warning"]
    status = "❌ Blocked: fix the errors below and rebuild" if errors else "✅ Built"
    out = [
        "# Budget data validation report",
        "",
        f"- **Status:** {status}",
        f"- **Source:** `{m['source_file']}` (sha256 `{m['source_sha256'][:12]}`)",
        f"- **Budget year:** {m['budget_year']}  ·  **As of:** {m['as_of']}  ·  **Currency:** {m['currency'] or 'n/a'}",
        f"- **Lines:** {m['line_count']}  ·  **Total budget:** {m['total_budget']:,.0f}",
        f"- **Errors:** {len(errors)}  ·  **Warnings:** {len(warnings)}",
        "",
    ]
    for title, items in (("Errors", errors), ("Warnings", warnings)):
        out += [f"## {title}", ""]
        if not items:
            out += ["None.", ""]
            continue
        out += ["| Row | Line ID | Field | Message |", "|---|---|---|---|"]
        for i in items:
            msg = i["message"].replace("|", "\\|")
            out.append(f"| {i['row'] or ''} | {i['line_id'] or ''} | {i['field'] or ''} | {msg} |")
        out.append("")
    return "\n".join(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path, help="budget spreadsheet (.xlsx or .csv)")
    ap.add_argument("--sheet", help="sheet name in an .xlsx (default: 'Budget', else the first sheet)")
    ap.add_argument("--as-of", type=dt.date.fromisoformat, default=dt.date.today(),
                    help="reference date for renewal urgency, YYYY-MM-DD (default: today)")
    ap.add_argument("--year", type=int, help="budget year label (default: the year after --as-of)")
    ap.add_argument("--out", type=Path, default=ROOT / "site" / "data.js")
    ap.add_argument("--report", type=Path, default=ROOT / "reports" / "validation-report.md")
    args = ap.parse_args(argv)

    if not args.input.exists():
        print(f"error: {args.input} not found", file=sys.stderr)
        return 2
    try:
        rows = read_rows(args.input, args.sheet)
    except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as e:
        print(f"error: could not read {args.input}: {e}", file=sys.stderr)
        return 2

    sha = hashlib.sha256(args.input.read_bytes()).hexdigest()
    payload = build(rows, as_of=args.as_of, budget_year=args.year or args.as_of.year + 1,
                    source=args.input.name, sha256=sha)
    m = payload["meta"]

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(render_report(payload), encoding="utf-8")

    if m["error_count"]:
        print(f"✗ {m['error_count']} error(s), {m['warning_count']} warning(s). {args.out} was NOT updated.")
        for i in payload["issues"]:
            if i["level"] == "error":
                where = f"row {i['row']} " if i["row"] else ""
                print(f"  - {where}{i['message']}")
        print(f"  Full report: {args.report}")
        return 1

    write_data_js(payload, args.out)
    print(f"✓ {m['line_count']} lines, total {m['total_budget']:,.0f} {m['currency']}, "
          f"{m['warning_count']} warning(s). Wrote {args.out} and {args.report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
