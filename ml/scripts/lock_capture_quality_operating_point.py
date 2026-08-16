#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    QUALITY_LABELS,
    calibrate_threshold,
    capture_quality_challenge_gate,
    load_split_manifest,
    validation_operating_metrics,
)
from mil_ojos_ml.capture_quality_model import (  # noqa: E402
    CaptureQualityDataset,
    TinyDepthwiseQualityNet,
    infer_scores,
    load_json,
)
from mil_ojos_ml.provenance import sha256  # noqa: E402

DEFAULT_CONFIG = ROOT / "ml" / "config" / "capture_quality_operating_v2.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fija umbrales contra controles limpios antes de un nuevo desafio"
    )
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit("El operating point ya existe y es inmutable")
    candidate_path = args.candidate / "candidate.json"
    candidate = load_json(candidate_path)
    config = load_json(args.config)
    if candidate["modelSha256"] != config["fixedModel"]["sha256"]:
        raise SystemExit("El modelo no coincide con el hash fijado para v2")
    candidate_config = load_json(args.candidate / candidate["config"])
    split_path = Path(candidate["splitManifest"])
    split_manifest = load_split_manifest(split_path)
    checkpoint = args.candidate / candidate["checkpoint"]
    model_path = args.candidate / candidate["model"]
    for path, expected in (
        (split_path, candidate["splitManifestSha256"]),
        (checkpoint, candidate["checkpointSha256"]),
        (model_path, candidate["modelSha256"]),
    ):
        if sha256(path) != expected:
            raise SystemExit(f"Hash alterado antes de calibrar v2: {path}")

    model = TinyDepthwiseQualityNet()
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    model.eval()
    dataset = CaptureQualityDataset(
        split_manifest,
        split=config["calibration"]["sourceSplit"],
        image_size=candidate_config["input"]["height"],
        transform_config=candidate_config["transforms"],
        seed=candidate_config["seed"],
        evaluation=True,
        include_baseline=False,
    )
    loader = DataLoader(
        dataset,
        batch_size=candidate_config["training"]["batchSize"],
        shuffle=False,
    )

    model.eval()
    score_parts = []
    variants: list[str] = []
    with torch.inference_mode():
        for batch in loader:
            score_parts.append(torch.sigmoid(model(batch["input"])).numpy())
            variants.extend(batch["variant"])
    scores = np.concatenate(score_parts)
    variants_array = np.asarray(variants)
    clean_fpr = config["calibration"][
        "maximumPerLabelFalseAlertRateOnCleanControls"
    ]
    thresholds = []
    for index, label in enumerate(QUALITY_LABELS):
        relevant = (variants_array == "clean") | (variants_array == label)
        binary_labels = (variants_array[relevant] == label).astype(np.int64)
        thresholds.append(
            calibrate_threshold(
                binary_labels,
                scores[relevant, index],
                maximum_false_positive_rate=clean_fpr,
            )
        )
    thresholds_array = np.asarray(thresholds, dtype=np.float64)
    confidence_level = config["challenge"]["confidenceLevel"]
    validation = validation_operating_metrics(
        variants_array,
        scores,
        thresholds_array,
        confidence_level=confidence_level,
    )
    gate_decision = capture_quality_challenge_gate(validation, config["challenge"])
    operating_point = {
        "schemaVersion": 1,
        "candidate": str(args.candidate.resolve()),
        "candidateSha256": sha256(candidate_path),
        "challengeOpened": False,
        "config": "CONFIG.json",
        "configSha256": sha256(args.config),
        "experimentId": config["experimentId"],
        "fixedModelSha256": candidate["modelSha256"],
        "lockedAt": datetime.now(UTC).isoformat(),
        "thresholdCalibration": (
            "Per label, positive synthetic variant versus untransformed controls only; "
            "the crack/no-crack nuisance label is not an output."
        ),
        "thresholds": [float(value) for value in thresholds_array],
        "validation": validation,
        "validationGate": gate_decision,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{args.output.name}.staging-", dir=args.output.parent)
    )
    try:
        shutil.copy2(args.config, staging / "CONFIG.json")
        (staging / "operating-point.json").write_text(
            json.dumps(operating_point, allow_nan=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staging.replace(args.output)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    print(json.dumps(operating_point, allow_nan=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
