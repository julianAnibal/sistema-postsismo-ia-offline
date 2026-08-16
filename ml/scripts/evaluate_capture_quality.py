#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    QUALITY_LABELS,
    clean_control_alert_intervals,
    cluster_bootstrap_intervals,
    evaluate_score_matrix,
    load_split_manifest,
)
from mil_ojos_ml.capture_quality_model import (  # noqa: E402
    CaptureQualityDataset,
    TinyDepthwiseQualityNet,
    infer_scores,
    load_json,
)
from mil_ojos_ml.provenance import sha256  # noqa: E402

DEFAULT_CANDIDATE = ROOT / "private-data" / "capture-quality" / "candidate-v1"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Abre una sola vez el test registrado de calidad sintetica"
    )
    parser.add_argument("--candidate", type=Path, default=DEFAULT_CANDIDATE)
    parser.add_argument("--open-test", action="store_true")
    parser.add_argument("--bootstrap-replicates", type=int)
    args = parser.parse_args()

    if not args.open_test:
        raise SystemExit("Abrir el test requiere confirmacion explicita --open-test")
    report_path = args.candidate / "TEST-REPORT.json"
    scores_path = args.candidate / "test-scores.npz"
    if report_path.exists() or scores_path.exists():
        raise SystemExit("El test de este candidato ya fue abierto")

    candidate = load_json(args.candidate / "candidate.json")
    config_path = args.candidate / candidate["config"]
    config = load_json(config_path)
    split_path = Path(candidate["splitManifest"])
    split_manifest = load_split_manifest(split_path)
    checkpoint = args.candidate / candidate["checkpoint"]
    model_path = args.candidate / candidate["model"]
    for path, expected in (
        (config_path, candidate["configSha256"]),
        (split_path, candidate["splitManifestSha256"]),
        (checkpoint, candidate["checkpointSha256"]),
        (model_path, candidate["modelSha256"]),
    ):
        if sha256(path) != expected:
            raise SystemExit(f"Hash alterado antes de abrir test: {path}")

    image_size = config["input"]["height"]
    model = TinyDepthwiseQualityNet()
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    model.eval()
    batch_size = config["training"]["batchSize"]
    test_dataset = CaptureQualityDataset(
        split_manifest,
        split="test",
        image_size=image_size,
        transform_config=config["transforms"],
        seed=config["seed"],
        evaluation=True,
    )
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    inference = infer_scores(model, test_loader, device=torch.device("cpu"))
    model_thresholds = candidate["thresholds"]["model"]
    baseline_thresholds = candidate["thresholds"]["baseline"]
    model_metrics = evaluate_score_matrix(
        inference["labels"],
        inference["modelScores"],
        model_thresholds,
    )
    baseline_metrics = evaluate_score_matrix(
        inference["labels"],
        inference["baselineScores"],
        baseline_thresholds,
    )
    replicates = (
        args.bootstrap_replicates
        if args.bootstrap_replicates is not None
        else config["evaluation"]["bootstrapReplicates"]
    )
    intervals = cluster_bootstrap_intervals(
        inference["labels"],
        inference["modelScores"],
        inference["baselineScores"],
        inference["clusterIds"],
        model_thresholds=model_thresholds,
        baseline_thresholds=baseline_thresholds,
        replicates=replicates,
        confidence_level=config["evaluation"]["confidenceLevel"],
        seed=config["seed"] + 1,
    )
    clean_control_alerts = clean_control_alert_intervals(
        inference["variants"],
        inference["modelScores"],
        model_thresholds,
        confidence_level=config["evaluation"]["confidenceLevel"],
    )

    ood_dataset = CaptureQualityDataset(
        split_manifest,
        split="test",
        image_size=image_size,
        transform_config=config["transforms"],
        seed=config["seed"],
        evaluation=True,
        ood_motion_blur=True,
    )
    ood_loader = DataLoader(ood_dataset, batch_size=batch_size, shuffle=False)
    ood = infer_scores(model, ood_loader, device=torch.device("cpu"))
    blur_index = QUALITY_LABELS.index("synthetic_blur")
    ood_model_recall = float(
        np.mean(ood["modelScores"][:, blur_index] >= model_thresholds[blur_index])
    )
    ood_baseline_recall = float(
        np.mean(ood["baselineScores"][:, blur_index] >= baseline_thresholds[blur_index])
    )

    benchmark_result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "ml" / "scripts" / "benchmark_onnx.py"),
            "--model",
            str(model_path),
            "--image-size",
            str(image_size),
            "--threads",
            "1",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if benchmark_result.returncode != 0:
        raise SystemExit(f"Benchmark ONNX fallo: {benchmark_result.stderr}")
    benchmark = json.loads(benchmark_result.stdout)

    gates = {
        "anyAlertOnCleanControlWilsonUpper": {
            "passed": clean_control_alerts["anyAlertOnCleanControl"]["upper"]
            <= config["selection"]["maximumFalsePositiveRate"],
            "requiredMaximum": config["selection"]["maximumFalsePositiveRate"],
            "value": clean_control_alerts["anyAlertOnCleanControl"]["upper"],
        },
        "macroAurocLower95": {
            "passed": intervals["modelMacroAuroc"]["lower"]
            >= config["selection"]["minimumMacroAurocLower95"],
            "required": config["selection"]["minimumMacroAurocLower95"],
            "value": intervals["modelMacroAuroc"]["lower"],
        },
        "modelBytes": {
            "passed": candidate["modelBytes"] <= config["model"]["maximumOnnxBytes"],
            "requiredMaximum": config["model"]["maximumOnnxBytes"],
            "value": candidate["modelBytes"],
        },
        "onnxParity": {
            "passed": candidate["parity"]["maximumAbsoluteError"]
            <= config["selection"]["maximumOnnxParityAbsoluteError"],
            "requiredMaximum": config["selection"]["maximumOnnxParityAbsoluteError"],
            "value": candidate["parity"]["maximumAbsoluteError"],
        },
        "pairedImprovementLower95": {
            "passed": intervals["pairedMacroBalancedAccuracyImprovement"]["lower"]
            >= config["selection"][
                "minimumPairedMacroBalancedAccuracyImprovement"
            ],
            "required": config["selection"][
                "minimumPairedMacroBalancedAccuracyImprovement"
            ],
            "value": intervals["pairedMacroBalancedAccuracyImprovement"]["lower"],
        },
        "perLabelRecallLower95": {
            "passed": all(
                value["lower"]
                >= config["selection"]["minimumPerLabelRecallLower95"]
                for value in intervals["perLabelRecall"].values()
            ),
            "required": config["selection"]["minimumPerLabelRecallLower95"],
            "values": {
                label: value["lower"]
                for label, value in intervals["perLabelRecall"].items()
            },
        },
    }
    development_gates_passed = all(value["passed"] for value in gates.values())
    selection = "tiny-cnn" if development_gates_passed else "deterministic-baseline"
    report = {
        "schemaVersion": 1,
        "benchmark": benchmark,
        "candidateSha256": sha256(args.candidate / "candidate.json"),
        "claimScope": (
            "Known synthetic corruptions on held-out concrete patches from one public "
            "source after perceptual clustering; not field or post-earthquake validation."
        ),
        "cleanControlAlerts": clean_control_alerts,
        "developmentGatesPassed": development_gates_passed,
        "experimentId": config["experimentId"],
        "gates": gates,
        "intervals": intervals,
        "knownExternalBlockers": [
            "Parent-photo identity is unavailable, so source-scene independence is unproven.",
            "No expert-reviewed real capture-quality dataset is present.",
            "No physical Android or iOS phone benchmark has been run.",
        ],
        "model": model_metrics,
        "modelReleased": False,
        "oodMotionBlur": {
            "baselineRecall": ood_baseline_recall,
            "modelRecall": ood_model_recall,
            "status": "challenge-only-not-a-field-claim",
        },
        "pixelBaseline": baseline_metrics,
        "recordCount": len(inference["labels"]),
        "selectedImplementation": selection,
        "testOpenedAt": datetime.now(UTC).isoformat(),
        "thresholdSource": "validation-split-locked-before-test",
    }
    np.savez_compressed(
        scores_path,
        baseline_scores=inference["baselineScores"],
        labels=inference["labels"],
        model_scores=inference["modelScores"],
        record_ids=np.asarray(inference["recordIds"]),
        variants=np.asarray(inference["variants"]),
    )
    report_path.write_text(
        json.dumps(report, allow_nan=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, allow_nan=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
