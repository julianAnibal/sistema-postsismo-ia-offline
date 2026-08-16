from __future__ import annotations

import json
from pathlib import Path

from .dataset import fingerprint


def build_manifest(model_path: Path, output_path: Path, *, model_id: str, version: str, runtime: str) -> dict:
    if runtime not in {"litert-lm", "onnx-runtime-mobile"}:
        raise ValueError(f"runtime no soportado: {runtime}")
    if not model_path.is_file():
        raise FileNotFoundError(model_path)
    manifest = {
        "id": model_id,
        "version": version,
        "runtime": runtime,
        "sha256": fingerprint(model_path),
        "sizeBytes": model_path.stat().st_size,
        "minimumMemoryBytes": 0,
        "licenseNoticePath": "NOTICE.txt",
        "status": "unreleased",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest
