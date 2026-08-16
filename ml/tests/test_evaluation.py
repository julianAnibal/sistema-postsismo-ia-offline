import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.dataset import write_jsonl  # noqa: E402
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
            self.assertTrue(evaluate_predictions(path)["passed"])

    def test_unstructured_prediction_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.jsonl"
            write_jsonl(path, [{"record_id": "one", "prediction": "todo bien"}])
            self.assertFalse(evaluate_predictions(path)["passed"])


if __name__ == "__main__":
    unittest.main()
