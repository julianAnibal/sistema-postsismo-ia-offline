#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.dataset import fingerprint  # noqa: E402
from mil_ojos_ml.model_pack import (  # noqa: E402
    RELEASE_DISABLED_REASON,
    SHA256_PATTERN,
    SUPPORTED_CPU_ARCHITECTURES,
    build_manifest,
)

PACKAGE_TASKS = ("language-drafting",)


def _parse_cpu_architectures(value: str) -> list[str]:
    architectures = [item.strip() for item in value.split(",") if item.strip()]
    unknown = [item for item in architectures if item not in SUPPORTED_CPU_ARCHITECTURES]
    if unknown:
        raise argparse.ArgumentTypeError(
            f"arquitecturas no soportadas: {unknown}; usa {list(SUPPORTED_CPU_ARCHITECTURES)}"
        )
    return architectures


def _load_complete_evaluation_report(
    path: Path,
    metric: str,
    value: float,
    *,
    dataset_release_id: str,
    model_sha256: str,
) -> dict:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
        raise SystemExit(f"Reporte de evaluacion JSON invalido: {exc}") from exc
    if not isinstance(report, dict):
        raise SystemExit("El reporte de evaluacion debe ser un objeto JSON")
    rates = report.get("rates")
    measured = rates.get(metric) if isinstance(rates, dict) else None
    coverage = report.get("coverage")
    count = report.get("count")
    identity = report.get("evidenceIdentity")
    if (
        report.get("passed") is not True
        or report.get("evaluation_evidence_complete") is not True
        or isinstance(count, bool)
        or not isinstance(count, int)
        or count <= 0
        or not isinstance(coverage, dict)
        or coverage.get("supervised_records") != count
        or coverage.get("citation_context_records") != count
        or report.get("failures") != []
        or report.get("integrityFailures") != []
        or not isinstance(identity, dict)
        or identity.get("datasetReleaseId") != dataset_release_id
        or identity.get("modelSha256") != model_sha256
        or not isinstance(identity.get("predictionsSha256"), str)
        or not SHA256_PATTERN.fullmatch(identity["predictionsSha256"])
        or not isinstance(identity.get("sealedTestManifestSha256"), str)
        or not SHA256_PATTERN.fullmatch(identity["sealedTestManifestSha256"])
        or isinstance(measured, bool)
        or not isinstance(measured, (int, float))
        or not math.isfinite(measured)
    ):
        raise SystemExit(
            "El reporte no contiene una evaluacion completa, aprobada y medible"
        )
    if not math.isclose(float(measured), value, rel_tol=0.0, abs_tol=1e-12):
        raise SystemExit(
            f"La metrica declarada ({value}) no coincide con el reporte ({measured})"
        )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Empaqueta un modelo movil ya convertido")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--notice", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--task", choices=PACKAGE_TASKS)
    parser.add_argument("--estimated-peak-memory-bytes", type=int, default=0)
    parser.add_argument("--minimum-memory-bytes", type=int, default=0)
    parser.add_argument("--minimum-free-storage-bytes", type=int, default=0)
    parser.add_argument(
        "--supported-cpu-architectures",
        type=_parse_cpu_architectures,
        default=[],
    )
    parser.add_argument("--evaluation-metric")
    parser.add_argument("--evaluation-value", type=float)
    parser.add_argument("--evaluation-dataset-release-id")
    parser.add_argument("--evaluation-report", type=Path)
    parser.add_argument("--released", action="store_true")
    args = parser.parse_args()

    if args.released:
        raise SystemExit(RELEASE_DISABLED_REASON)

    if args.model.suffix != ".litertlm":
        raise SystemExit("El modelo debe estar convertido al formato .litertlm")
    if not args.notice.is_file():
        raise SystemExit(f"Aviso de licencia inexistente: {args.notice}")

    evaluation_values = (
        args.evaluation_metric,
        args.evaluation_value,
        args.evaluation_dataset_release_id,
        args.evaluation_report,
    )
    if any(value is not None for value in evaluation_values) and not all(
        value is not None for value in evaluation_values
    ):
        raise SystemExit(
            "La evaluacion requiere metric, value, dataset-release-id y report"
        )
    if args.evaluation_report and (
        not args.evaluation_report.is_file() or args.evaluation_report.suffix.lower() != ".json"
    ):
        raise SystemExit("--evaluation-report debe ser un archivo JSON existente")
    if args.output.exists():
        raise SystemExit("El directorio de salida ya existe; los paquetes son inmutables")

    evaluation = None
    if args.evaluation_report:
        _load_complete_evaluation_report(
            args.evaluation_report,
            args.evaluation_metric,
            args.evaluation_value,
            dataset_release_id=args.evaluation_dataset_release_id,
            model_sha256=fingerprint(args.model),
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{args.output.name}.staging-", dir=args.output.parent)
    )
    try:
        model_target = staging / args.model.name
        notice_target = staging / "NOTICE.txt"
        shutil.copy2(args.model, model_target)
        shutil.copy2(args.notice, notice_target)
        if args.evaluation_report:
            report_target = staging / "EVALUATION.json"
            shutil.copy2(args.evaluation_report, report_target)
            evaluation = {
                "metric": args.evaluation_metric,
                "value": args.evaluation_value,
                "datasetReleaseId": args.evaluation_dataset_release_id,
                "reportSha256": fingerprint(report_target),
                "reportPath": report_target.name,
            }
        manifest = build_manifest(
            model_target,
            staging / "model-pack.json",
            model_id=args.id,
            version=args.version,
            runtime="litert-lm",
            task=args.task,
            estimated_peak_memory_bytes=args.estimated_peak_memory_bytes,
            minimum_memory_bytes=args.minimum_memory_bytes,
            minimum_free_storage_bytes=args.minimum_free_storage_bytes,
            supported_cpu_architectures=args.supported_cpu_architectures,
            evaluation=evaluation,
            released=args.released,
        )
        if args.output.exists():
            raise FileExistsError("El directorio de salida aparecio durante el empaquetado")
        staging.rename(args.output)
    except (ValueError, FileNotFoundError, FileExistsError, OSError) as exc:
        raise SystemExit(str(exc)) from exc
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    print(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
