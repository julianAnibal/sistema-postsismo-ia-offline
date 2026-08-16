#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import platform
import shutil
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import cv2
import PIL
from torch import nn
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
    model_parameter_count,
)
from mil_ojos_ml.provenance import sha256  # noqa: E402

DEFAULT_CONFIG = ROOT / "ml" / "config" / "capture_quality_v1.json"
DEFAULT_SPLIT = ROOT / "private-data" / "capture-quality" / "split-v1.json"


def make_loader(
    dataset: CaptureQualityDataset,
    *,
    batch_size: int,
    workers: int,
    shuffle: bool,
    seed: int,
) -> DataLoader:
    generator = torch.Generator()
    generator.manual_seed(seed)
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=workers,
        generator=generator,
        persistent_workers=False,
    )


def calibrated_evaluation(
    inference: dict,
    *,
    maximum_false_positive_rate: float,
) -> tuple[dict, dict[str, list[float]]]:
    labels = inference["labels"]
    model_scores = inference["modelScores"]
    baseline_scores = inference["baselineScores"]
    model_thresholds = [
        calibrate_threshold(
            labels[:, index],
            model_scores[:, index],
            maximum_false_positive_rate=maximum_false_positive_rate,
        )
        for index in range(len(QUALITY_LABELS))
    ]
    baseline_thresholds = [
        calibrate_threshold(
            labels[:, index],
            baseline_scores[:, index],
            maximum_false_positive_rate=maximum_false_positive_rate,
        )
        for index in range(len(QUALITY_LABELS))
    ]
    return (
        {
            "baseline": evaluate_score_matrix(
                labels,
                baseline_scores,
                baseline_thresholds,
            ),
            "model": evaluate_score_matrix(labels, model_scores, model_thresholds),
        },
        {
            "baseline": [float(value) for value in baseline_thresholds],
            "model": [float(value) for value in model_thresholds],
        },
    )


def export_and_check(
    model: nn.Module,
    destination: Path,
    *,
    image_size: int,
    opset: int,
) -> dict:
    model = model.cpu().eval()
    generator = torch.Generator().manual_seed(1000)
    example = torch.rand((4, 3, image_size, image_size), generator=generator)
    torch.onnx.export(
        model,
        example,
        destination,
        export_params=True,
        opset_version=opset,
        do_constant_folding=True,
        input_names=["image"],
        output_names=["quality_logits"],
        dynamic_axes={
            "image": {0: "batch"},
            "quality_logits": {0: "batch"},
        },
        dynamo=False,
    )
    package = onnx.load(destination)
    onnx.checker.check_model(package, full_check=True)
    session = ort.InferenceSession(
        str(destination),
        providers=["CPUExecutionProvider"],
    )
    with torch.inference_mode():
        expected = model(example).numpy()
    actual = session.run(None, {"image": example.numpy()})[0]
    absolute_error = np.abs(expected - actual)
    return {
        "maximumAbsoluteError": float(absolute_error.max()),
        "meanAbsoluteError": float(absolute_error.mean()),
        "onnxChecker": "passed",
        "opset": opset,
        "provider": session.get_providers()[0],
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Entrena sin abrir el test el candidato de calidad sintetica"
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--split-manifest", type=Path, default=DEFAULT_SPLIT)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "private-data" / "capture-quality" / "candidate-v1",
    )
    parser.add_argument("--device", choices=("cpu", "mps"), default="cpu")
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit("El directorio candidato ya existe y es inmutable")
    if args.device == "mps" and not torch.backends.mps.is_available():
        raise SystemExit("MPS no esta disponible")
    config = load_json(args.config)
    split_manifest = load_split_manifest(args.split_manifest)
    if split_manifest["configSha256"] != sha256(args.config):
        raise SystemExit("El split no corresponde al hash de la configuracion")

    seed = config["seed"]
    torch.manual_seed(seed)
    np.random.seed(seed)
    torch.use_deterministic_algorithms(True)
    torch.set_num_threads(min(6, os.cpu_count() or 1))
    device = torch.device(args.device)
    image_size = config["input"]["height"]
    if image_size != config["input"]["width"]:
        raise SystemExit("Este experimento requiere entrada cuadrada")
    training = config["training"]
    workers = min(training["maximumWorkers"], max((os.cpu_count() or 1) - 1, 0))
    train_dataset = CaptureQualityDataset(
        split_manifest,
        split="train",
        image_size=image_size,
        transform_config=config["transforms"],
        seed=seed,
        evaluation=False,
        include_baseline=False,
    )
    validation_dataset = CaptureQualityDataset(
        split_manifest,
        split="validation",
        image_size=image_size,
        transform_config=config["transforms"],
        seed=seed,
        evaluation=True,
    )
    validation_loader = make_loader(
        validation_dataset,
        batch_size=training["batchSize"],
        workers=workers,
        shuffle=False,
        seed=seed,
    )

    model = TinyDepthwiseQualityNet().to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=training["learningRate"],
        weight_decay=training["weightDecay"],
    )
    loss_function = nn.BCEWithLogitsLoss(
        pos_weight=torch.full((len(QUALITY_LABELS),), 4.0, device=device)
    )
    best_score = -math.inf
    best_epoch = 0
    best_state = None
    history = []
    started = time.perf_counter()

    for epoch in range(training["epochs"]):
        train_dataset.set_epoch(epoch)
        train_loader = make_loader(
            train_dataset,
            batch_size=training["batchSize"],
            workers=workers,
            shuffle=True,
            seed=seed + epoch,
        )
        model.train()
        loss_sum = 0.0
        sample_count = 0
        for batch in train_loader:
            inputs = batch["input"].to(device=device, dtype=torch.float32)
            targets = batch["target"].to(device=device, dtype=torch.float32)
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(inputs), targets)
            loss.backward()
            optimizer.step()
            loss_sum += float(loss.detach()) * len(inputs)
            sample_count += len(inputs)

        inference = infer_scores(model, validation_loader, device=device)
        metrics, _ = calibrated_evaluation(
            inference,
            maximum_false_positive_rate=config["selection"][
                "maximumFalsePositiveRate"
            ],
        )
        score = metrics["model"]["macroAuroc"]
        history.append(
            {
                "epoch": epoch + 1,
                "trainLoss": loss_sum / sample_count,
                "validationMacroAuroc": score,
            }
        )
        print(json.dumps(history[-1], sort_keys=True), flush=True)
        if score > best_score:
            best_score = score
            best_epoch = epoch + 1
            best_state = copy.deepcopy(model.state_dict())

    if best_state is None:
        raise SystemExit("El entrenamiento no produjo un checkpoint")
    model.load_state_dict(best_state)
    final_inference = infer_scores(model, validation_loader, device=device)
    validation_metrics, thresholds = calibrated_evaluation(
        final_inference,
        maximum_false_positive_rate=config["selection"]["maximumFalsePositiveRate"],
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{args.output.name}.staging-", dir=args.output.parent)
    )
    try:
        checkpoint = staging / "model-state.pt"
        model_cpu = model.cpu().eval()
        torch.save(model_cpu.state_dict(), checkpoint)
        onnx_path = staging / "capture-quality-fp32.onnx"
        parity = export_and_check(
            model_cpu,
            onnx_path,
            image_size=image_size,
            opset=config["model"]["opset"],
        )
        shutil.copy2(args.config, staging / "CONFIG.json")
        candidate = {
            "schemaVersion": 1,
            "bestEpoch": best_epoch,
            "checkpoint": checkpoint.name,
            "checkpointSha256": sha256(checkpoint),
            "config": "CONFIG.json",
            "configSha256": sha256(args.config),
            "createdAt": datetime.now(UTC).isoformat(),
            "device": str(device),
            "elapsedSeconds": time.perf_counter() - started,
            "experimentId": config["experimentId"],
            "history": history,
            "model": onnx_path.name,
            "modelBytes": onnx_path.stat().st_size,
            "modelParameterCount": model_parameter_count(model_cpu),
            "modelSha256": sha256(onnx_path),
            "parity": parity,
            "splitManifest": str(args.split_manifest.resolve()),
            "splitManifestSha256": sha256(args.split_manifest),
            "softwareVersions": {
                "host": platform.platform(),
                "numpy": np.__version__,
                "onnx": onnx.__version__,
                "onnxruntime": ort.__version__,
                "opencv": cv2.__version__,
                "pillow": PIL.__version__,
                "python": platform.python_version(),
                "torch": torch.__version__,
            },
            "testOpened": False,
            "thresholds": thresholds,
            "validation": validation_metrics,
        }
        (staging / "candidate.json").write_text(
            json.dumps(candidate, allow_nan=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staging.replace(args.output)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    print(json.dumps(candidate, allow_nan=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
