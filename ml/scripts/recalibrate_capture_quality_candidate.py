#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import torch
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    QUALITY_LABELS,
    calibrate_threshold,
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deriva metadatos estrictos sin cambiar pesos ni abrir el test"
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit("El candidato derivado ya existe y es inmutable")
    source_candidate_path = args.source / "candidate.json"
    candidate = load_json(source_candidate_path)
    if candidate.get("testOpened") is not False:
        raise SystemExit("Solo se deriva un candidato cuyo test sigue cerrado")
    config = load_json(args.source / candidate["config"])
    split_path = Path(candidate["splitManifest"])
    split_manifest = load_split_manifest(split_path)
    checkpoint = args.source / candidate["checkpoint"]
    model_path = args.source / candidate["model"]
    for path, expected in (
        (args.source / candidate["config"], candidate["configSha256"]),
        (split_path, candidate["splitManifestSha256"]),
        (checkpoint, candidate["checkpointSha256"]),
        (model_path, candidate["modelSha256"]),
    ):
        if sha256(path) != expected:
            raise SystemExit(f"Hash alterado en candidato fuente: {path}")

    model = TinyDepthwiseQualityNet()
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    model.eval()
    dataset = CaptureQualityDataset(
        split_manifest,
        split="validation",
        image_size=config["input"]["height"],
        transform_config=config["transforms"],
        seed=config["seed"],
        evaluation=True,
    )
    loader = DataLoader(
        dataset,
        batch_size=config["training"]["batchSize"],
        shuffle=False,
    )
    inference = infer_scores(model, loader, device=torch.device("cpu"))
    maximum_fpr = config["selection"]["maximumFalsePositiveRate"]
    model_thresholds = [
        calibrate_threshold(
            inference["labels"][:, index],
            inference["modelScores"][:, index],
            maximum_false_positive_rate=maximum_fpr,
        )
        for index in range(len(QUALITY_LABELS))
    ]
    baseline_thresholds = [
        calibrate_threshold(
            inference["labels"][:, index],
            inference["baselineScores"][:, index],
            maximum_false_positive_rate=maximum_fpr,
        )
        for index in range(len(QUALITY_LABELS))
    ]
    candidate["derivedFromCandidateSha256"] = sha256(source_candidate_path)
    candidate["metadataRevision"] = 2
    candidate["recalibratedAt"] = datetime.now(UTC).isoformat()
    candidate["thresholds"] = {
        "baseline": [float(value) for value in baseline_thresholds],
        "model": [float(value) for value in model_thresholds],
    }
    candidate["validation"] = {
        "baseline": evaluate_score_matrix(
            inference["labels"],
            inference["baselineScores"],
            baseline_thresholds,
        ),
        "model": evaluate_score_matrix(
            inference["labels"],
            inference["modelScores"],
            model_thresholds,
        ),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{args.output.name}.staging-", dir=args.output.parent)
    )
    try:
        for path in args.source.iterdir():
            if path.is_file():
                shutil.copy2(path, staging / path.name)
        (staging / "candidate.json").write_text(
            json.dumps(candidate, allow_nan=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staging.replace(args.output)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    print(
        json.dumps(
            {
                "candidate": str(args.output),
                "modelSha256": candidate["modelSha256"],
                "sourceCandidateSha256": candidate["derivedFromCandidateSha256"],
                "testOpened": False,
                "thresholds": candidate["thresholds"],
            },
            allow_nan=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
