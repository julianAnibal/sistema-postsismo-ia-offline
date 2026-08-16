#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    capture_quality_challenge_gate,
    load_split_manifest,
    validation_operating_metrics,
)
from mil_ojos_ml.capture_quality_model import (  # noqa: E402
    CaptureQualityDataset,
    TinyDepthwiseQualityNet,
)
from mil_ojos_ml.provenance import sha256  # noqa: E402


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Se esperaba un objeto JSON: {path}")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audita si un operating point puede abrir el desafio sellado"
    )
    parser.add_argument("--operating-point", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit("La auditoria ya existe y es inmutable")
    operating_point = load_json(args.operating_point)
    config_path = args.operating_point.parent / operating_point["config"]
    config = load_json(config_path)
    if sha256(config_path) != operating_point["configSha256"]:
        raise SystemExit("El hash de CONFIG.json no coincide")
    if operating_point.get("challengeOpened") is not False:
        raise SystemExit("La auditoria previa solo aplica antes de abrir el desafio")

    candidate_directory = Path(operating_point["candidate"])
    candidate_path = candidate_directory / "candidate.json"
    if sha256(candidate_path) != operating_point["candidateSha256"]:
        raise SystemExit("El candidato no coincide con el hash fijado")
    candidate = load_json(candidate_path)
    if candidate.get("modelSha256") != operating_point.get("fixedModelSha256"):
        raise SystemExit("El modelo candidato no coincide con el operating point")
    candidate_config_path = candidate_directory / candidate["config"]
    split_path = Path(candidate["splitManifest"])
    checkpoint_path = candidate_directory / candidate["checkpoint"]
    model_path = candidate_directory / candidate["model"]
    for artifact, expected in (
        (candidate_config_path, candidate["configSha256"]),
        (split_path, candidate["splitManifestSha256"]),
        (checkpoint_path, candidate["checkpointSha256"]),
        (model_path, candidate["modelSha256"]),
    ):
        if sha256(artifact) != expected:
            raise SystemExit(f"Artefacto candidato alterado: {artifact}")

    candidate_config = load_json(candidate_config_path)
    split_manifest = load_split_manifest(split_path)
    model = TinyDepthwiseQualityNet()
    model.load_state_dict(
        torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    )
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
    score_parts: list[np.ndarray] = []
    variants: list[str] = []
    with torch.inference_mode():
        for batch in loader:
            score_parts.append(torch.sigmoid(model(batch["input"])).numpy())
            variants.extend(batch["variant"])
    recomputed_validation = validation_operating_metrics(
        np.asarray(variants),
        np.concatenate(score_parts),
        operating_point["thresholds"],
        confidence_level=config["challenge"]["confidenceLevel"],
    )
    if recomputed_validation != operating_point.get("validation"):
        raise SystemExit("Las metricas persistidas no coinciden con el recalculo")

    gate = capture_quality_challenge_gate(
        recomputed_validation,
        config["challenge"],
    )
    audit = {
        "schemaVersion": 1,
        "auditId": "CQ-OPERATING-V2-AUDIT-001",
        "auditedAt": datetime.now(UTC).isoformat(),
        "operatingPointSha256": sha256(args.operating_point),
        "configSha256": sha256(config_path),
        "recomputedFromArtifacts": True,
        "recomputedArtifactHashes": {
            "candidate": sha256(candidate_path),
            "checkpoint": sha256(checkpoint_path),
            "model": sha256(model_path),
            "splitManifest": sha256(split_path),
        },
        **gate,
        "testSetOpened": False,
        "modelReleased": False,
        "requiredAction": (
            "Redefine or remove the failing synthetic construct using observable, "
            "protocol-grounded data; lock a new operating point before any new test."
            if not gate["challengeEligible"]
            else "Open the preregistered challenge exactly once."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(audit, allow_nan=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(audit, allow_nan=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
