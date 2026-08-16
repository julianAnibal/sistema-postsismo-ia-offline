from __future__ import annotations

import json
import math
import re
from pathlib import Path, PurePosixPath
from typing import Iterable

from .dataset import fingerprint

SUPPORTED_RUNTIMES = ("litert-lm", "onnx-runtime-mobile")
SUPPORTED_TASKS = (
    "capture-quality",
    "visible-condition-segmentation",
    "language-drafting",
)
SUPPORTED_CPU_ARCHITECTURES = (
    "arm64",
    "arm64-v8a",
    "armeabi-v7a",
    "x86_64",
    "x86",
)
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$", re.I)
RELEASE_DISABLED_REASON = (
    "released esta deshabilitado hasta que el paquete pase validacion del formato "
    "LiteRT-LM, paridad numerica e inicializacion en el runtime movil exacto"
)

REQUIRED_FIELDS = (
    "manifestVersion",
    "id",
    "version",
    "runtime",
    "task",
    "sha256",
    "sizeBytes",
    "minimumMemoryBytes",
    "estimatedPeakMemoryBytes",
    "minimumFreeStorageBytes",
    "supportedCpuArchitectures",
    "licenseNoticePath",
    "released",
    "status",
    "evaluation",
)


def _non_negative_int(value, *, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{field} debe ser un entero no negativo")
    return value


def _safe_relative_path(value, *, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} debe ser una ruta relativa no vacia")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"{field} debe permanecer dentro del paquete")
    return value


def _cpu_architectures(value: Iterable[str] | None) -> list[str]:
    if value is None:
        return []
    architectures: list[str] = []
    for architecture in value:
        if architecture not in SUPPORTED_CPU_ARCHITECTURES:
            raise ValueError(
                f"arquitectura no soportada: {architecture!r}; "
                f"usa {list(SUPPORTED_CPU_ARCHITECTURES)}"
            )
        if architecture not in architectures:
            architectures.append(architecture)
    return architectures


def _evaluation(value) -> dict | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("evaluation debe ser un objeto")
    metric = value.get("metric")
    score = value.get("value")
    dataset_release_id = value.get("datasetReleaseId")
    report_sha256 = value.get("reportSha256")
    report_path = value.get("reportPath")
    if not isinstance(metric, str) or not metric.strip():
        raise ValueError("evaluation.metric es obligatorio")
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score):
        raise ValueError("evaluation.value debe ser numerico y finito")
    if not isinstance(dataset_release_id, str) or not dataset_release_id.strip():
        raise ValueError("evaluation.datasetReleaseId es obligatorio")
    if not isinstance(report_sha256, str) or not SHA256_PATTERN.fullmatch(report_sha256):
        raise ValueError("evaluation.reportSha256 debe ser SHA-256 hexadecimal")
    return {
        "metric": metric,
        "value": score,
        "datasetReleaseId": dataset_release_id,
        "reportSha256": report_sha256.lower(),
        "reportPath": _safe_relative_path(report_path, field="evaluation.reportPath"),
    }


def validate_manifest(manifest: dict) -> None:
    """Reject packages that hide provenance, evaluation, or phone cost."""
    if not isinstance(manifest, dict):
        raise ValueError("manifest debe ser un objeto")
    missing = [field for field in REQUIRED_FIELDS if field not in manifest]
    if missing:
        raise ValueError(f"manifest sin campos obligatorios: {missing}")
    if manifest["manifestVersion"] != 1:
        raise ValueError("manifestVersion no soportada")
    if not isinstance(manifest["id"], str) or not manifest["id"].strip():
        raise ValueError("id debe ser una cadena no vacia")
    if not isinstance(manifest["version"], str) or not manifest["version"].strip():
        raise ValueError("version debe ser una cadena no vacia")
    if manifest["runtime"] not in SUPPORTED_RUNTIMES:
        raise ValueError(f"runtime no soportado: {manifest['runtime']!r}")
    if manifest["task"] is not None and manifest["task"] not in SUPPORTED_TASKS:
        raise ValueError(f"task no soportada: {manifest['task']!r}")
    if not isinstance(manifest["sha256"], str) or not SHA256_PATTERN.fullmatch(manifest["sha256"]):
        raise ValueError("sha256 debe ser hexadecimal de 64 caracteres")

    size = _non_negative_int(manifest["sizeBytes"], field="sizeBytes")
    minimum_memory = _non_negative_int(
        manifest["minimumMemoryBytes"], field="minimumMemoryBytes"
    )
    peak_memory = _non_negative_int(
        manifest["estimatedPeakMemoryBytes"], field="estimatedPeakMemoryBytes"
    )
    minimum_storage = _non_negative_int(
        manifest["minimumFreeStorageBytes"], field="minimumFreeStorageBytes"
    )
    if size <= 0:
        raise ValueError("sizeBytes debe ser positivo")
    if minimum_memory and peak_memory > minimum_memory:
        raise ValueError("estimatedPeakMemoryBytes no puede superar minimumMemoryBytes")

    architectures = manifest["supportedCpuArchitectures"]
    if not isinstance(architectures, list):
        raise ValueError("supportedCpuArchitectures debe ser una lista")
    _cpu_architectures(architectures)
    _safe_relative_path(manifest["licenseNoticePath"], field="licenseNoticePath")
    evaluation = _evaluation(manifest["evaluation"])

    released = manifest["released"]
    if not isinstance(released, bool):
        raise ValueError("released debe ser booleano")
    expected_status = "released" if released else "unreleased"
    if manifest["status"] != expected_status:
        raise ValueError("status y released son inconsistentes")
    if released:
        raise ValueError(RELEASE_DISABLED_REASON)
    if minimum_storage and minimum_storage < size:
        raise ValueError("minimumFreeStorageBytes debe incluir al menos el tamano del paquete")


def build_manifest(
    model_path: Path,
    output_path: Path,
    *,
    model_id: str,
    version: str,
    runtime: str,
    task: str | None = None,
    estimated_peak_memory_bytes: int = 0,
    minimum_memory_bytes: int = 0,
    minimum_free_storage_bytes: int = 0,
    supported_cpu_architectures: Iterable[str] = (),
    evaluation: dict | None = None,
    released: bool = False,
    license_notice_path: str = "NOTICE.txt",
) -> dict:
    if not model_path.is_file():
        raise FileNotFoundError(model_path)
    if released:
        raise ValueError(RELEASE_DISABLED_REASON)
    manifest = {
        "manifestVersion": 1,
        "id": model_id,
        "version": version,
        "runtime": runtime,
        "task": task,
        "sha256": fingerprint(model_path),
        "sizeBytes": model_path.stat().st_size,
        "minimumMemoryBytes": minimum_memory_bytes,
        "estimatedPeakMemoryBytes": estimated_peak_memory_bytes,
        "minimumFreeStorageBytes": minimum_free_storage_bytes,
        "supportedCpuArchitectures": _cpu_architectures(supported_cpu_architectures),
        "licenseNoticePath": license_notice_path,
        "released": released,
        "status": "released" if released else "unreleased",
        "evaluation": _evaluation(evaluation),
    }
    validate_manifest(manifest)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return manifest
