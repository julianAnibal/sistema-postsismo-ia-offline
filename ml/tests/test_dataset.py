import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.dataset import (  # noqa: E402
    LEGACY_GROUP_FIELDS,
    assert_no_group_leakage,
    assert_unique_record_ids,
    grouped_split,
    leakage_report,
    read_jsonl,
    validate_dataset,
    validate_record,
)

PREPARE_SCRIPT = ROOT / "scripts" / "prepare_dataset.py"


class DatasetTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = read_jsonl(ROOT / "data" / "demo" / "sft.jsonl")

    def test_demo_dataset_is_valid(self):
        report = validate_dataset(self.records)
        self.assertTrue(report["valid"], report["errors"])
        self.assertEqual(report["record_count"], 9)

    def test_split_has_no_group_leakage(self):
        splits = grouped_split(self.records)
        report = assert_no_group_leakage(splits)
        self.assertTrue(all(splits.values()))
        self.assertEqual(report["group_fields"], ["event_id"])

    def test_default_split_isolates_complete_events(self):
        splits = grouped_split(self.records)
        event_sets = [set(row["event_id"] for row in rows) for rows in splits.values()]
        for index, events in enumerate(event_sets):
            for other in event_sets[index + 1 :]:
                self.assertFalse(events & other)

    def test_duplicate_record_ids_fail_before_splitting(self):
        duplicate = copy.deepcopy(self.records[0])
        duplicate["infrastructure_id"] = "infra-z9"
        with self.assertRaisesRegex(ValueError, "record_id duplicado"):
            grouped_split(self.records + [duplicate])
        with self.assertRaisesRegex(ValueError, "record_id duplicado"):
            assert_unique_record_ids(self.records + [duplicate])

    def test_empty_dataset_and_insufficient_event_groups_fail(self):
        self.assertFalse(validate_dataset([])["valid"])
        with self.assertRaisesRegex(ValueError, "al menos tres grupos"):
            grouped_split(self.records[:2])

    def test_invalid_grouping_is_rejected(self):
        with self.assertRaises(ValueError):
            grouped_split(self.records, group_fields=())
        with self.assertRaises(ValueError):
            grouped_split(self.records, group_fields=("source_id",))

    def test_leakage_report_identifies_shared_events(self):
        report = leakage_report(
            {
                "train": self.records[:3],
                "validation": self.records[:2],
                "test": self.records[6:],
            }
        )
        self.assertFalse(report["disjoint"])
        self.assertTrue(report["overlap"])

    def test_legacy_grouping_requires_cli_opt_in(self):
        with tempfile.TemporaryDirectory() as directory:
            command = [
                sys.executable,
                str(PREPARE_SCRIPT),
                "--input",
                str(ROOT / "data" / "demo" / "sft.jsonl"),
                "--output",
                directory,
                "--group-fields",
                ",".join(LEGACY_GROUP_FIELDS),
            ]
            refused = subprocess.run(command, capture_output=True, text=True, check=False)
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("--allow-legacy-grouping", refused.stderr)
            allowed = subprocess.run(
                command + ["--allow-legacy-grouping"],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(allowed.returncode, 0, allowed.stderr)
            self.assertTrue(json.loads(allowed.stdout)["leakage"]["disjoint"])

    def test_pii_is_rejected(self):
        record = json.loads(json.dumps(self.records[0]))
        record["messages"][1]["content"] += " Contacto: persona@example.com"
        self.assertTrue(any("PII" in error for error in validate_record(record)))

    def test_automatic_verdict_is_rejected(self):
        record = json.loads(json.dumps(self.records[0]))
        output = json.loads(record["messages"][-1]["content"])
        output["summary"] = "El edificio es seguro."
        record["messages"][-1]["content"] = json.dumps(output)
        self.assertTrue(any("dictamen" in error for error in validate_record(record)))

    def test_accented_or_imperative_verdict_is_rejected(self):
        for summary in ("La vivienda está habitable.", "Puede entrar.", "Evacúe ahora."):
            with self.subTest(summary=summary):
                record = copy.deepcopy(self.records[0])
                output = json.loads(record["messages"][-1]["content"])
                output["summary"] = summary
                record["messages"][-1]["content"] = json.dumps(output)
                self.assertTrue(any("dictamen" in error for error in validate_record(record)))

    def test_malformed_records_are_reported_instead_of_crashing(self):
        malformed = copy.deepcopy(self.records[0])
        malformed["messages"] = ["not-an-object", {}, {}]
        malformed["review"] = "approved"
        report = validate_dataset([42, malformed])
        self.assertFalse(report["valid"])
        self.assertTrue(any("objeto" in error for error in report["errors"]))

    def test_draft_2020_schema_rejects_task_boolean_and_extra_properties(self):
        invalid_task = copy.deepcopy(self.records[0])
        invalid_task["task"] = "habitability_verdict"
        self.assertTrue(any("schema task" in error for error in validate_record(invalid_task)))

        invalid_synthetic = copy.deepcopy(self.records[0])
        invalid_synthetic["synthetic"] = "not-a-boolean"
        self.assertTrue(
            any("schema synthetic" in error for error in validate_record(invalid_synthetic))
        )

        extra = copy.deepcopy(self.records[0])
        extra["unregistered"] = True
        self.assertTrue(any("Additional properties" in error for error in validate_record(extra)))


if __name__ == "__main__":
    unittest.main()
