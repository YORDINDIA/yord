import csv
import json
import sys
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import Mock

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

import apply_product_patches
import import_orders_customers as orders_import
import ingest_enriched
import ingest_new_blogs
import tidy_collections


class ImportOrderTests(unittest.TestCase):
    def test_name_grouping_keeps_continuation_line_items_and_source_id(self):
        fields = [
            "Name", "Id", "Email", "Total", "Lineitem name",
            "Lineitem quantity", "Lineitem price",
        ]
        rows = [
            {
                "Name": "#YORD0042", "Id": "", "Email": "buyer@example.com",
                "Total": "150", "Lineitem name": "First tee",
                "Lineitem quantity": "1", "Lineitem price": "100",
            },
            {
                "Name": "#YORD0042", "Id": "123456", "Email": "",
                "Total": "", "Lineitem name": "Second tee",
                "Lineitem quantity": "1", "Lineitem price": "50",
            },
            {
                "Name": "", "Id": "", "Email": "", "Total": "",
                "Lineitem name": "Third tee", "Lineitem quantity": "1",
                "Lineitem price": "25",
            },
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "orders.csv"
            with path.open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)
            old_path = orders_import.ORDERS_CSV
            orders_import.ORDERS_CSV = path
            try:
                loaded = orders_import.load_orders()
            finally:
                orders_import.ORDERS_CSV = old_path

        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0]["shopify_id"], 123456)
        self.assertEqual(loaded[0]["_source_name"], "#YORD0042")
        self.assertEqual(loaded[0]["order_number"], 42)
        self.assertEqual(
            [line["title"] for line in loaded[0]["line_items"]],
            ["First tee", "Second tee", "Third tee"],
        )

    def test_idless_order_gets_deterministic_id(self):
        one = orders_import.stable_synthetic_id(orders_import.ORDER_STUB_BASE, "#YORD44")
        two = orders_import.stable_synthetic_id(orders_import.ORDER_STUB_BASE, "#YORD44")
        other = orders_import.stable_synthetic_id(orders_import.ORDER_STUB_BASE, "#YORD45")
        self.assertEqual(one, two)
        self.assertNotEqual(one, other)

    def test_synthetic_fulfillment_and_price_rule_ids_ignore_list_position(self):
        rows = [
            {"awb_no": "AWB-1", "order_id": "100", "status": "Delivered"},
            {"awb_no": "AWB-2", "order_id": "200", "status": "Shipped"},
        ]
        forward = {row["awb_no"]: orders_import.fulfillment_id(row) for row in rows}
        reverse = {row["awb_no"]: orders_import.fulfillment_id(row) for row in reversed(rows)}
        self.assertEqual(forward, reverse)
        self.assertEqual(
            orders_import.price_rule_id("SAVE10"),
            orders_import.price_rule_id("SAVE10"),
        )
        self.assertNotEqual(
            orders_import.price_rule_id("SAVE10"),
            orders_import.price_rule_id("SAVE20"),
        )

    def test_row_errors_are_counted_for_checkpoint_decision(self):
        self.assertEqual(
            orders_import.step_row_error_count({
                "order_errors": 2,
                "billing_errors": 1,
                "auth_failed": 3,
            }),
            6,
        )

    def test_rollback_refuses_legacy_snapshot_without_database_calls(self):
        client = Mock()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "legacy.json"
            path.write_text(json.dumps({"tables": {"orders": [{"id": 1}]}}))
            with self.assertRaisesRegex(RuntimeError, "no complete per-run write journal"):
                orders_import.rollback(client, path)
        client.table.assert_not_called()

    def test_rollback_restores_existing_and_deletes_only_run_created(self):
        client = Mock()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "snapshot.json"
            path.write_text(json.dumps({
                "complete_tables": ["orders"],
                "run_writes": {
                    "orders": [
                        {"key": {"id": 10}, "before": {"id": 10, "name": "before"}},
                        {"key": {"id": 11}, "before": None},
                    ],
                },
                "auth_user_emails": [],
            }))
            orders_import.rollback(client, path)

        self.assertEqual(client.table.call_count, 2)
        calls = client.table.call_args_list
        self.assertEqual([call.args[0] for call in calls], ["orders", "orders"])
        self.assertEqual(calls[0].kwargs, {})
        client.table.return_value.upsert.assert_called_once_with(
            [{"id": 10, "name": "before"}], on_conflict="id"
        )
        client.table.return_value.delete.return_value.eq.assert_called_once_with("id", 11)

    def test_write_intent_journals_prior_values_and_new_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "snapshot.json"
            path.write_text(json.dumps({
                "complete_tables": ["orders"],
                "tables": {"orders": [{"id": 10, "name": "before"}]},
                "run_writes": {},
            }))
            old_path = orders_import.ACTIVE_SNAPSHOT_PATH
            orders_import.ACTIVE_SNAPSHOT_PATH = path
            try:
                orders_import.record_write_intent(
                    "orders", [{"id": 10, "name": "after"}, {"id": 11, "name": "new"}]
                )
            finally:
                orders_import.ACTIVE_SNAPSHOT_PATH = old_path
            journal = json.loads(path.read_text())["run_writes"]["orders"]

        self.assertEqual(journal[0]["before"], {"id": 10, "name": "before"})
        self.assertIsNone(journal[1]["before"])

    def test_snapshots_use_unique_files_and_order_by_rollback_keys(self):
        order_calls = []

        class Query:
            def __init__(self, table):
                self.table = table

            def select(self, _columns):
                return self

            def order(self, column):
                order_calls.append((self.table, column))
                return self

            def range(self, _start, _end):
                return self

            def execute(self):
                return SimpleNamespace(data=[])

        class Client:
            auth = SimpleNamespace(admin=SimpleNamespace(
                list_users=lambda _page, _per_page: {"users": []}
            ))

            def table(self, table):
                return Query(table)

        with tempfile.TemporaryDirectory() as tmp:
            snapshot_dir = Path(tmp)
            first = orders_import.write_snapshot(Client(), "orders", snapshot_dir)
            second = orders_import.write_snapshot(Client(), "orders", snapshot_dir)

            self.assertNotEqual(first, second)
            self.assertTrue(first.exists())
            self.assertTrue(second.exists())

        self.assertEqual(
            order_calls,
            [
                (table, key)
                for table in orders_import.SNAPSHOT_TABLES
                for key in orders_import.WRITE_KEYS[table]
            ] * 2,
        )


class OtherScriptTests(unittest.TestCase):
    def test_enriched_variants_create_product_option_rows(self):
        rows = ingest_enriched.build_product_options(123, [
            {"option1": "S", "option2": "Regular"},
            {"option1": "M", "option2": "Regular"},
            {"option1": "S", "option2": "Oversize"},
        ])
        self.assertEqual([row["name"] for row in rows], ["Size", "Style"])
        self.assertEqual(rows[0]["values"], ["S", "M"])
        self.assertEqual(rows[1]["values"], ["Regular", "Oversize"])
        self.assertEqual([row["position"] for row in rows], [1, 2])

    def test_enriched_options_infer_color_size_and_restore_third_axis(self):
        variants = [
            {
                "title": "Concert tee - White / S / regular",
                "option1": "White",
                "option2": "S",
            },
            {
                "title": "Concert tee - White / M / oversize",
                "option1": "White",
                "option2": "M",
            },
        ]
        rows = ingest_enriched.build_product_options(
            123, variants, product_title="Concert tee"
        )

        self.assertEqual([row["name"] for row in rows], ["Color", "Size", "Style"])
        self.assertEqual(rows[0]["values"], ["White"])
        self.assertEqual(rows[1]["values"], ["S", "M"])
        self.assertEqual(rows[2]["values"], ["regular", "oversize"])
        self.assertEqual(
            ingest_enriched.variant_option_values(variants[0], "Concert tee"),
            ("White", "S", "regular"),
        )

    def test_patch_counts_only_returned_updated_rows(self):
        response = Mock(status_code=200)
        response.json.return_value = [{"id": 1}, {"id": 2}]
        self.assertEqual(apply_product_patches.confirmed_updated_count(response), 2)
        response.status_code = 204
        self.assertEqual(apply_product_patches.confirmed_updated_count(response), 0)

    def test_blog_response_rejects_http_failure_and_wrong_shape(self):
        response = Mock(status_code=500, text="database unavailable")
        with self.assertRaisesRegex(RuntimeError, "HTTP 500"):
            ingest_new_blogs.response_rows(response, "articles")

        response = Mock(status_code=200)
        response.json.return_value = {"error": "bad response"}
        with self.assertRaisesRegex(RuntimeError, "JSON array of objects"):
            ingest_new_blogs.response_rows(response, "articles")

    def test_tidy_refuses_delete_when_merge_target_is_missing(self):
        tidy = tidy_collections.CollectionTidy.__new__(tidy_collections.CollectionTidy)
        tidy.by_handle = {"best-sellers": {"id": 2}}
        tidy.delete = True
        tidy.supabase = Mock()
        with self.assertRaisesRegex(RuntimeError, "canonical merge target"):
            tidy.delete_duplicates()
        tidy.supabase.table.assert_not_called()


if __name__ == "__main__":
    unittest.main()
