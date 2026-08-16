import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.dataset import fingerprint  # noqa: E402
from mil_ojos_ml.model_pack import (  # noqa: E402
    RELEASE_DISABLED_REASON,
    build_manifest,
    validate_manifest,
)


class ModelPackTest(unittest.TestCase):
    def setUp(self):
        self._temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self._temporary.name)
        self.model = self.directory / "model.litertlm"
        self.model.write_bytes(b"DEMO MODEL")

    def tearDown(self):
        self._temporary.cleanup()

    def evaluation(self) -> dict:
        return {
            "metric": "field_fidelity",
            "value": 0.97,
            "datasetReleaseId": "sealed-events-v1",
            "reportSha256": "b" * 64,
            "reportPath": "EVALUATION.json",
        }

    def candidate_manifest(self, **overrides) -> dict:
        values = {
            "task": "language-drafting",
            "estimated_peak_memory_bytes": 500_000_000,
            "minimum_memory_bytes": 4_000_000_000,
            "minimum_free_storage_bytes": 3_000_000_000,
            "supported_cpu_architectures": ["arm64-v8a"],
            "evaluation": self.evaluation(),
            "released": False,
        }
        values.update(overrides)
        return build_manifest(
            self.model,
            self.directory / "model-pack.json",
            model_id="1000-ojos-language",
            version="1.0.0",
            runtime="litert-lm",
            **values,
        )

    def test_unreleased_placeholder_is_explicit(self):
        manifest = build_manifest(
            self.model,
            self.directory / "model-pack.json",
            model_id="demo",
            version="0.0.0-demo",
            runtime="litert-lm",
        )
        self.assertFalse(manifest["released"])
        self.assertEqual(manifest["status"], "unreleased")
        self.assertIsNone(manifest["task"])
        self.assertIsNone(manifest["evaluation"])

    def test_release_is_fail_closed_even_with_plausible_metadata(self):
        with self.assertRaisesRegex(ValueError, "deshabilitado"):
            self.candidate_manifest(released=True)
        manifest = self.candidate_manifest()
        manifest["released"] = True
        manifest["status"] = "released"
        with self.assertRaisesRegex(ValueError, "deshabilitado"):
            validate_manifest(manifest)
        self.assertIn("paridad", RELEASE_DISABLED_REASON)

    def test_manifest_rejects_unsafe_task_and_inconsistent_release_status(self):
        with self.assertRaisesRegex(ValueError, "task no soportada"):
            self.candidate_manifest(task="habitability-verdict")
        manifest = self.candidate_manifest()
        manifest["status"] = "released"
        with self.assertRaisesRegex(ValueError, "inconsistentes"):
            validate_manifest(manifest)

    def test_manifest_rejects_fake_evaluation_and_paths(self):
        with self.assertRaisesRegex(ValueError, "reportSha256"):
            self.candidate_manifest(evaluation={**self.evaluation(), "reportSha256": "fake"})
        with self.assertRaisesRegex(ValueError, "dentro del paquete"):
            self.candidate_manifest(
                evaluation={**self.evaluation(), "reportPath": "../report.json"}
            )

    def test_minimum_storage_includes_model_bytes(self):
        with self.assertRaisesRegex(ValueError, "tamano del paquete"):
            self.candidate_manifest(minimum_free_storage_bytes=1)

    def test_packaging_cli_refuses_released_until_runtime_proof_exists(self):
        notice = self.directory / "NOTICE.txt"
        notice.write_text("demo license", encoding="utf-8")
        report = self.directory / "report.json"
        report.write_text(
            json.dumps(
                {
                    "count": 10,
                    "passed": True,
                    "evaluation_evidence_complete": True,
                    "coverage": {
                        "supervised_records": 10,
                        "citation_context_records": 10,
                    },
                    "failures": [],
                    "rates": {"field_fidelity": 0.97},
                }
            )
            + "\n",
            encoding="utf-8",
        )
        output = self.directory / "release"
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "package_model.py"),
                "--model",
                str(self.model),
                "--notice",
                str(notice),
                "--output",
                str(output),
                "--id",
                "1000-ojos-language",
                "--version",
                "1.0.0",
                "--task",
                "language-drafting",
                "--estimated-peak-memory-bytes",
                "500000000",
                "--minimum-memory-bytes",
                "4000000000",
                "--minimum-free-storage-bytes",
                "3000000000",
                "--supported-cpu-architectures",
                "arm64-v8a",
                "--evaluation-metric",
                "field_fidelity",
                "--evaluation-value",
                "0.97",
                "--evaluation-dataset-release-id",
                "sealed-events-v1",
                "--evaluation-report",
                str(report),
                "--released",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("deshabilitado", result.stderr)
        self.assertFalse(output.exists())

    def test_unreleased_candidate_binds_and_copies_complete_evaluation(self):
        notice = self.directory / "NOTICE.txt"
        notice.write_text("demo license", encoding="utf-8")
        report = self.directory / "candidate-report.json"
        report.write_text(
            json.dumps(
                {
                    "count": 10,
                    "passed": True,
                    "evaluation_evidence_complete": True,
                    "coverage": {
                        "supervised_records": 10,
                        "citation_context_records": 10,
                    },
                    "failures": [],
                    "integrityFailures": [],
                    "rates": {"field_fidelity": 0.97},
                    "evidenceIdentity": {
                        "datasetReleaseId": "sealed-events-v1",
                        "modelSha256": fingerprint(self.model),
                        "predictionsSha256": "c" * 64,
                        "sealedTestManifestSha256": "d" * 64,
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )
        output = self.directory / "candidate-package"
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "package_model.py"),
                "--model",
                str(self.model),
                "--notice",
                str(notice),
                "--output",
                str(output),
                "--id",
                "1000-ojos-language",
                "--version",
                "0.1.0-candidate",
                "--task",
                "language-drafting",
                "--evaluation-metric",
                "field_fidelity",
                "--evaluation-value",
                "0.97",
                "--evaluation-dataset-release-id",
                "sealed-events-v1",
                "--evaluation-report",
                str(report),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((output / "model-pack.json").read_text())
        self.assertFalse(manifest["released"])
        self.assertEqual(
            manifest["evaluation"]["reportSha256"],
            fingerprint(output / "EVALUATION.json"),
        )

    def test_packaging_cli_rejects_incomplete_evaluation_without_partial_output(self):
        notice = self.directory / "NOTICE.txt"
        notice.write_text("demo license", encoding="utf-8")
        report = self.directory / "report.json"
        report.write_text('{"passed": true}\n', encoding="utf-8")
        output = self.directory / "rejected-release"
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "package_model.py"),
                "--model",
                str(self.model),
                "--notice",
                str(notice),
                "--output",
                str(output),
                "--id",
                "1000-ojos-language",
                "--version",
                "1.0.0",
                "--task",
                "language-drafting",
                "--evaluation-metric",
                "field_fidelity",
                "--evaluation-value",
                "0.97",
                "--evaluation-dataset-release-id",
                "sealed-events-v1",
                "--evaluation-report",
                str(report),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("evaluacion completa", result.stderr)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
