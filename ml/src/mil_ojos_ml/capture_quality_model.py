from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import Dataset

from .capture_quality import (
    QUALITY_LABELS,
    VARIANTS,
    apply_motion_blur,
    apply_synthetic_variant,
    deterministic_scores,
    image_tensor,
    load_rgb,
    stable_seed,
    variant_targets,
)


class DepthwiseBlock(nn.Sequential):
    def __init__(self, input_channels: int, output_channels: int, *, stride: int):
        super().__init__(
            nn.Conv2d(
                input_channels,
                input_channels,
                kernel_size=3,
                stride=stride,
                padding=1,
                groups=input_channels,
                bias=False,
            ),
            nn.BatchNorm2d(input_channels),
            nn.ReLU6(inplace=True),
            nn.Conv2d(input_channels, output_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(output_channels),
            nn.ReLU6(inplace=True),
        )


class TinyDepthwiseQualityNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 12, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(12),
            nn.ReLU6(inplace=True),
            DepthwiseBlock(12, 16, stride=2),
            DepthwiseBlock(16, 24, stride=2),
            DepthwiseBlock(24, 32, stride=2),
            DepthwiseBlock(32, 48, stride=2),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Linear(48, len(QUALITY_LABELS))

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        features = self.features(inputs).flatten(1)
        return self.classifier(features)


def model_parameter_count(model: nn.Module) -> int:
    return sum(parameter.numel() for parameter in model.parameters())


class CaptureQualityDataset(Dataset):
    def __init__(
        self,
        manifest: dict,
        *,
        split: str,
        image_size: int,
        transform_config: dict,
        seed: int,
        evaluation: bool,
        ood_motion_blur: bool = False,
        include_baseline: bool = True,
    ):
        self.source_root = Path(manifest["sourceRoot"])
        self.records = [
            record for record in manifest["records"] if record["split"] == split
        ]
        if not self.records:
            raise ValueError(f"El split {split!r} esta vacio")
        self.image_size = image_size
        self.transform_config = transform_config
        self.seed = seed
        self.evaluation = evaluation
        self.ood_motion_blur = ood_motion_blur
        self.include_baseline = include_baseline
        self.epoch = 0

    def set_epoch(self, epoch: int) -> None:
        self.epoch = epoch

    def __len__(self) -> int:
        if self.ood_motion_blur:
            return len(self.records)
        return len(self.records) * len(VARIANTS) if self.evaluation else len(self.records)

    def _record_variant(self, index: int) -> tuple[dict, str]:
        if self.ood_motion_blur:
            return self.records[index], "synthetic_blur"
        if self.evaluation:
            record_index, variant_index = divmod(index, len(VARIANTS))
            return self.records[record_index], VARIANTS[variant_index]
        record = self.records[index]
        variant_index = (stable_seed(self.seed, record["id"]) + self.epoch) % len(VARIANTS)
        return record, VARIANTS[variant_index]

    def __getitem__(self, index: int):
        record, variant = self._record_variant(index)
        image = load_rgb(self.source_root / record["id"], size=self.image_size)
        rng = np.random.default_rng(
            stable_seed(self.seed, record["id"], variant, self.epoch, "pixels")
        )
        if not self.evaluation and not self.ood_motion_blur:
            if rng.random() < 0.5:
                image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            rotations = int(rng.integers(0, 4))
            if rotations:
                image = image.rotate(90 * rotations)
        if self.ood_motion_blur:
            image = apply_motion_blur(image, rng=rng)
        else:
            image = apply_synthetic_variant(
                image,
                variant,
                rng=rng,
                transform_config=self.transform_config,
            )
        result = {
            "clusterId": record["clusterId"],
            "id": record["id"],
            "input": torch.from_numpy(image_tensor(image)),
            "target": torch.from_numpy(variant_targets(variant)),
            "variant": variant,
        }
        if self.include_baseline:
            result["baseline"] = torch.from_numpy(deterministic_scores(image))
        return result


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Se esperaba un objeto JSON en {path}")
    return value


def infer_scores(
    model: nn.Module,
    loader,
    *,
    device: torch.device,
) -> dict:
    model.eval()
    model_scores: list[np.ndarray] = []
    baseline_scores: list[np.ndarray] = []
    targets: list[np.ndarray] = []
    cluster_ids: list[str] = []
    record_ids: list[str] = []
    variants: list[str] = []
    with torch.inference_mode():
        for batch in loader:
            inputs = batch["input"].to(device=device, dtype=torch.float32)
            probabilities = torch.sigmoid(model(inputs)).cpu().numpy()
            model_scores.append(probabilities)
            baseline_scores.append(batch["baseline"].numpy())
            targets.append(batch["target"].numpy())
            cluster_ids.extend(batch["clusterId"])
            record_ids.extend(batch["id"])
            variants.extend(batch["variant"])
    return {
        "baselineScores": np.concatenate(baseline_scores),
        "clusterIds": cluster_ids,
        "labels": np.concatenate(targets),
        "modelScores": np.concatenate(model_scores),
        "recordIds": record_ids,
        "variants": variants,
    }
