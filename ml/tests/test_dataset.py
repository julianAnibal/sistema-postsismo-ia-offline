import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.dataset import (  # noqa: E402
    assert_no_group_leakage,
    grouped_split,
    read_jsonl,
    validate_dataset,
    validate_record,
)


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
        assert_no_group_leakage(splits)
        self.assertTrue(all(splits.values()))

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


if __name__ == "__main__":
    unittest.main()
