import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.dataset import fingerprint, write_jsonl  # noqa: E402
from mil_ojos_ml.evaluation import evaluate_predictions  # noqa: E402


class EvaluationTest(unittest.TestCase):
    def test_safe_structured_prediction_passes(self):
        output = {
            "summary": "Evidencia insuficiente.",
            "missing_fields": ["vista general"],
            "requires_expert_review": True,
            "source_ids": [],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            write_jsonl(path, [{"record_id": "one", "prediction": json.dumps(output)}])
            report = evaluate_predictions(path)
            self.assertTrue(report["passed"])
            self.assertFalse(report["evaluation_evidence_complete"])

    def test_unstructured_prediction_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            write_jsonl(path, [{"record_id": "one", "prediction": "todo bien"}])
            self.assertFalse(evaluate_predictions(path)["passed"])

    def test_citation_outside_retrieved_scope_fails(self):
        output = {
            "summary": "Borrador.",
            "missing_fields": [],
            "requires_expert_review": True,
            "source_ids": ["inventada"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            write_jsonl(
                path,
                [
                    {
                        "record_id": "one",
                        "prediction": json.dumps(output),
                        "allowed_source_ids": ["oficial-1"],
                    }
                ],
            )
            report = evaluate_predictions(path)
            self.assertEqual(report["rates"]["citation_scope"], 0.0)
            self.assertFalse(report["passed"])

    def test_expected_fields_and_citation_context_are_required_for_release_evidence(self):
        output = {
            "summary": "Borrador.",
            "missing_fields": ["vista general"],
            "requires_expert_review": True,
            "source_ids": ["oficial-1"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            write_jsonl(
                path,
                [
                    {
                        "record_id": "one",
                        "prediction": json.dumps(output),
                        "expected": output,
                        "allowed_source_ids": ["oficial-1"],
                    }
                ],
            )
            manifest_path = Path(directory) / "sealed-test-manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "datasetReleaseId": "sealed-events-v1",
                        "recordIds": ["one"],
                    },
                    sort_keys=True,
                )
                + "\n",
                encoding="utf-8",
            )
            report = evaluate_predictions(
                path,
                test_manifest_path=manifest_path,
                test_manifest_sha256=fingerprint(manifest_path),
                model_sha256="a" * 64,
            )
            self.assertTrue(report["evaluation_evidence_complete"])
            self.assertEqual(report["coverage"]["supervised_records"], 1)
            self.assertEqual(
                report["evidenceIdentity"]["datasetReleaseId"],
                "sealed-events-v1",
            )

    def test_duplicate_prediction_ids_fail_even_when_every_row_is_correct(self):
        output = {
            "summary": "Borrador.",
            "missing_fields": [],
            "requires_expert_review": True,
            "source_ids": ["oficial-1"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            row = {
                "record_id": "one",
                "prediction": json.dumps(output),
                "expected": output,
                "allowed_source_ids": ["oficial-1"],
            }
            write_jsonl(path, [row, row, row])
            report = evaluate_predictions(path)
            self.assertFalse(report["passed"])
            self.assertFalse(report["evaluation_evidence_complete"])
            self.assertIn("prediction_record_ids_duplicate", report["integrityFailures"])


if __name__ == "__main__":
    unittest.main()
