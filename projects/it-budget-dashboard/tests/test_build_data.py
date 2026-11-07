"""Unit tests for scripts/build_data.py. Standard library only.

    python3 -m unittest discover -s tests -v
"""
import datetime as dt
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_data as bd  # noqa: E402

AS_OF = dt.date(2026, 11, 7)
HEADER = ["line_id", "vendor", "product_or_service", "category", "cost_pool", "annual_budget", "currency",
          "owner", "cost_centre"]


def build(rows, header=HEADER):
    return bd.build([header] + rows, as_of=AS_OF, budget_year=2027)


def errors(payload):
    return [i for i in payload["issues"] if i["level"] == "error"]


def row(**kw):
    base = dict(line_id="A1", vendor="V", product_or_service="P", category="Licence", cost_pool="Software",
                annual_budget=1200, currency="EUR", owner="O", cost_centre="CC")
    base.update(kw)
    return [base[h] for h in HEADER]


class SampleFiles(unittest.TestCase):
    def test_csv_and_xlsx_samples_build_identically(self):
        csv_p = bd.build(bd.read_rows(ROOT / "data" / "sample-budget.csv"), as_of=AS_OF, budget_year=2027)
        xlsx_p = bd.build(bd.read_rows(ROOT / "data" / "sample-budget.xlsx"), as_of=AS_OF, budget_year=2027)
        self.assertEqual(errors(csv_p), [])
        self.assertEqual(errors(xlsx_p), [])
        self.assertEqual(csv_p["meta"]["total_budget"], xlsx_p["meta"]["total_budget"])
        strip = lambda p: [{k: v for k, v in l.items()} for l in p["lines"]]
        self.assertEqual(strip(csv_p), strip(xlsx_p))

    def test_template_has_headers_only(self):
        rows = bd.read_rows(ROOT / "data" / "budget-template.xlsx")
        payload = bd.build(rows, as_of=AS_OF, budget_year=2027)
        self.assertIn("No data rows found", " ".join(i["message"] for i in errors(payload)))


class Validation(unittest.TestCase):
    def test_valid_row(self):
        p = build([row()])
        self.assertEqual(errors(p), [])
        self.assertEqual(p["meta"]["total_budget"], 1200)
        self.assertEqual(p["lines"][0]["monthly"], [100.0] * 12)
        self.assertTrue(p["lines"][0]["monthly_derived"])

    def test_missing_required_column(self):
        p = build([["A1", "V"]], header=["line_id", "vendor"])
        self.assertTrue(any("'category' is missing" in i["message"] for i in errors(p)))
        self.assertEqual(p["lines"], [])

    def test_duplicate_id_bad_category_bad_number(self):
        p = build([row(), row(category="Hardware"), row(line_id="B", annual_budget="lots")])
        msgs = " ".join(i["message"] for i in errors(p))
        self.assertIn("Duplicate line_id", msgs)
        self.assertIn("Category 'Hardware'", msgs)
        self.assertIn("not a number", msgs)

    def test_mixed_currency_is_error(self):
        p = build([row(), row(line_id="B", currency="USD")])
        self.assertTrue(any("Mixed currencies" in i["message"] for i in errors(p)))

    def test_category_aliases_and_number_formats(self):
        p = build([row(category="licenses", annual_budget="€ 1,234.50")])
        self.assertEqual(errors(p), [])
        self.assertEqual(p["lines"][0]["category"], "Licence")
        self.assertEqual(p["lines"][0]["annual_budget"], 1234.5)

    def test_blank_owner_is_warning_not_error(self):
        p = build([row(owner="")])
        self.assertEqual(errors(p), [])
        self.assertTrue(any(i["field"] == "owner" for i in p["issues"]))

    def test_header_normalisation(self):
        header = ["Line ID", "Vendor", "Product", "Category", "Cost Pool", "Budget", "Currency", "January"]
        p = bd.build([header, ["A1", "V", "P", "Service", "Telecom", 120, "EUR", 120]], as_of=AS_OF, budget_year=2027)
        self.assertEqual(errors(p), [])
        line = p["lines"][0]
        self.assertEqual(line["product_or_service"], "P")
        self.assertEqual(line["monthly"][0], 120)
        self.assertFalse(line["monthly_derived"])


class Dates(unittest.TestCase):
    def test_excel_serial_and_iso(self):
        self.assertEqual(bd.parse_date(46022.0), "2025-12-31")
        self.assertEqual(bd.parse_date("2027-03-31"), "2027-03-31")
        with self.assertRaises(ValueError):
            bd.parse_date("31/03/2027")  # ambiguous day/month order is rejected on purpose

    def test_notice_deadline(self):
        header = HEADER + ["renewal_date", "notice_period_days", "auto_renew"]
        r = row() + ["2027-03-31", 90, "Y"]
        p = bd.build([header, r], as_of=AS_OF, budget_year=2027)
        self.assertEqual(p["lines"][0]["notice_deadline"], "2026-12-31")
        self.assertTrue(p["lines"][0]["auto_renew"])


if __name__ == "__main__":
    unittest.main()
