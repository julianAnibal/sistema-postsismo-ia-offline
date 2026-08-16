import hashlib
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.provenance import extract_zip_atomic, verify_artifact  # noqa: E402


class ProvenanceTest(unittest.TestCase):
    def setUp(self):
        self._temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self._temporary.name)

    def tearDown(self):
        self._temporary.cleanup()

    def test_verifies_exact_size_and_sha256(self):
        artifact = self.directory / "artifact.bin"
        artifact.write_bytes(b"registered bytes")
        expected = hashlib.sha256(artifact.read_bytes()).hexdigest()
        verify_artifact(
            artifact,
            expected_size=artifact.stat().st_size,
            expected_sha256=expected,
        )
        with self.assertRaisesRegex(ValueError, "SHA-256 inesperado"):
            verify_artifact(
                artifact,
                expected_size=artifact.stat().st_size,
                expected_sha256="0" * 64,
            )

    def test_extracts_zip_atomically(self):
        archive = self.directory / "safe.zip"
        with zipfile.ZipFile(archive, "w") as package:
            package.writestr("validation/Negative/example.jpg", b"image")
        output = self.directory / "output"
        extract_zip_atomic(archive, output, maximum_uncompressed_bytes=100)
        self.assertEqual(
            (output / "validation" / "Negative" / "example.jpg").read_bytes(),
            b"image",
        )

    def test_rejects_path_traversal_without_partial_output(self):
        archive = self.directory / "unsafe.zip"
        with zipfile.ZipFile(archive, "w") as package:
            package.writestr("../escape.txt", b"escape")
        output = self.directory / "output"
        with self.assertRaisesRegex(ValueError, "Ruta insegura"):
            extract_zip_atomic(archive, output, maximum_uncompressed_bytes=100)
        self.assertFalse(output.exists())
        self.assertFalse((self.directory / "escape.txt").exists())

    def test_rejects_uncompressed_size_limit(self):
        archive = self.directory / "oversized.zip"
        with zipfile.ZipFile(archive, "w") as package:
            package.writestr("large.bin", b"x" * 101)
        with self.assertRaisesRegex(ValueError, "limite descomprimido"):
            extract_zip_atomic(
                archive,
                self.directory / "output",
                maximum_uncompressed_bytes=100,
            )


if __name__ == "__main__":
    unittest.main()
