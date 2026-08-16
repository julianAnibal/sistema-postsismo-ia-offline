from __future__ import annotations

import hashlib
import json
import math
from statistics import NormalDist
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from .provenance import sha256

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
QUALITY_LABELS = (
    "synthetic_blur",
    "synthetic_underexposure",
    "synthetic_overexposure",
    "synthetic_occlusion",
)
VARIANTS = ("clean", *QUALITY_LABELS)


@dataclass(frozen=True)
class SourceRecord:
    record_id: str
    path: Path
    nuisance_label: str
    sha256: str
    phash: int


class UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, value: int) -> int:
        while self.parent[value] != value:
            self.parent[value] = self.parent[self.parent[value]]
            value = self.parent[value]
        return value

    def union(self, left: int, right: int) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def stable_seed(*parts: object) -> int:
    text = "|".join(str(part) for part in parts)
    return int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "big")


def perceptual_hash(path: Path, *, hash_size: int = 8) -> int:
    with Image.open(path) as image:
        grayscale = ImageOps.grayscale(image).resize(
            (hash_size * 4, hash_size * 4),
            Image.Resampling.LANCZOS,
        )
    values = np.asarray(grayscale, dtype=np.float32)
    coefficients = cv2.dct(values)[:hash_size, :hash_size]
    median = float(np.median(coefficients.reshape(-1)[1:]))
    bits = coefficients > median
    value = 0
    for bit in bits.reshape(-1):
        value = (value << 1) | int(bit)
    return value


def discover_source_records(root: Path) -> list[SourceRecord]:
    paths = sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )
    records: list[SourceRecord] = []
    for path in paths:
        relative = path.relative_to(root).as_posix()
        nuisance_label = next(
            (
                part.capitalize()
                for part in path.relative_to(root).parts[:-1]
                if part.lower() in {"negative", "positive"}
            ),
            "Unknown",
        )
        records.append(
            SourceRecord(
                record_id=relative,
                path=path,
                nuisance_label=nuisance_label,
                sha256=sha256(path),
                phash=perceptual_hash(path),
            )
        )
    if not records:
        raise ValueError(f"No se encontraron imagenes en {root}")
    return records


def perceptual_duplicate_clusters(
    records: Sequence[SourceRecord],
    *,
    maximum_hamming_distance: int,
) -> list[str]:
    if maximum_hamming_distance < 0 or maximum_hamming_distance > 4:
        raise ValueError("El agrupador multiindice admite Hamming entre 0 y 4")
    union = UnionFind(len(records))
    exact_sha: dict[str, int] = {}
    chunk_ranges = ((0, 13), (13, 26), (26, 39), (39, 52), (52, 64))
    buckets: list[dict[int, list[int]]] = [defaultdict(list) for _ in chunk_ranges]

    for index, record in enumerate(records):
        if record.sha256 in exact_sha:
            union.union(index, exact_sha[record.sha256])
        else:
            exact_sha[record.sha256] = index

        candidates: set[int] = set()
        for bucket, (start, end) in zip(buckets, chunk_ranges, strict=True):
            width = end - start
            chunk = (record.phash >> (64 - end)) & ((1 << width) - 1)
            candidates.update(bucket[chunk])
        for candidate in candidates:
            if (record.phash ^ records[candidate].phash).bit_count() <= maximum_hamming_distance:
                union.union(index, candidate)
        for bucket, (start, end) in zip(buckets, chunk_ranges, strict=True):
            width = end - start
            chunk = (record.phash >> (64 - end)) & ((1 << width) - 1)
            bucket[chunk].append(index)

    members: dict[int, list[int]] = defaultdict(list)
    for index in range(len(records)):
        members[union.find(index)].append(index)
    cluster_names: dict[int, str] = {}
    for root, indexes in members.items():
        identity = "\n".join(sorted(records[index].record_id for index in indexes))
        cluster_names[root] = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
    return [cluster_names[union.find(index)] for index in range(len(records))]


def assign_cluster_splits(
    records: Sequence[SourceRecord],
    clusters: Sequence[str],
    *,
    ratios: dict[str, float],
    seed: int,
) -> list[str]:
    if len(records) != len(clusters):
        raise ValueError("records y clusters deben tener la misma longitud")
    if set(ratios) != {"train", "validation", "test"}:
        raise ValueError("Los splits deben ser train, validation y test")
    if not math.isclose(sum(ratios.values()), 1.0, abs_tol=1e-9):
        raise ValueError("Las proporciones de split deben sumar 1")
    if any(value <= 0 for value in ratios.values()):
        raise ValueError("Todas las proporciones de split deben ser positivas")

    cluster_indexes: dict[str, list[int]] = defaultdict(list)
    for index, cluster in enumerate(clusters):
        cluster_indexes[cluster].append(index)
    labels = sorted({record.nuisance_label for record in records})
    totals = Counter(record.nuisance_label for record in records)
    targets = {
        split: {
            label: totals[label] * ratios[split]
            for label in labels
        }
        for split in ratios
    }
    assigned = {split: Counter() for split in ratios}
    cluster_order = sorted(
        cluster_indexes,
        key=lambda cluster: (
            -len(cluster_indexes[cluster]),
            stable_seed(seed, cluster),
        ),
    )
    cluster_split: dict[str, str] = {}
    split_order = ("train", "validation", "test")
    for cluster in cluster_order:
        counts = Counter(records[index].nuisance_label for index in cluster_indexes[cluster])

        def cost(split: str) -> tuple[float, float, int]:
            overflow = 0.0
            deficit = 0.0
            for label in labels:
                target = max(targets[split][label], 1.0)
                after = assigned[split][label] + counts[label]
                overflow += max(0.0, after - target) / target
                deficit += abs(after - target) / target
            return (overflow, deficit, split_order.index(split))

        chosen = min(split_order, key=cost)
        cluster_split[cluster] = chosen
        assigned[chosen].update(counts)
    return [cluster_split[cluster] for cluster in clusters]


def write_split_manifest(
    output: Path,
    *,
    source_root: Path,
    records: Sequence[SourceRecord],
    clusters: Sequence[str],
    splits: Sequence[str],
    source_provenance_sha256: str,
    config_sha256: str,
    maximum_hamming_distance: int,
    seed: int,
) -> dict:
    if not (len(records) == len(clusters) == len(splits)):
        raise ValueError("records, clusters y splits deben tener la misma longitud")
    overlap = {}
    for left, right in (("train", "validation"), ("train", "test"), ("validation", "test")):
        left_clusters = {clusters[index] for index, split in enumerate(splits) if split == left}
        right_clusters = {clusters[index] for index, split in enumerate(splits) if split == right}
        overlap[f"{left}__{right}"] = sorted(left_clusters & right_clusters)
    if any(overlap.values()):
        raise ValueError(f"Fuga de clusters entre splits: {overlap}")

    rows = [
        {
            "clusterId": clusters[index],
            "id": record.record_id,
            "nuisanceLabel": record.nuisance_label,
            "phash64": f"{record.phash:016x}",
            "sha256": record.sha256,
            "split": splits[index],
        }
        for index, record in enumerate(records)
    ]
    counts = Counter(row["split"] for row in rows)
    label_counts = {
        split: dict(
            sorted(
                Counter(
                    row["nuisanceLabel"] for row in rows if row["split"] == split
                ).items()
            )
        )
        for split in ("train", "validation", "test")
    }
    manifest = {
        "schemaVersion": 1,
        "configSha256": config_sha256,
        "maximumPerceptualHashHammingDistance": maximum_hamming_distance,
        "records": rows,
        "seed": seed,
        "sourceProvenanceSha256": source_provenance_sha256,
        "sourceRoot": str(source_root.resolve()),
        "summary": {
            "clusterCount": len(set(clusters)),
            "counts": dict(sorted(counts.items())),
            "labelCounts": label_counts,
            "perceptualClusterOverlap": overlap,
            "recordCount": len(rows),
        },
    }
    encoded = json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(encoded, encoding="utf-8")
    return manifest


def load_split_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise ValueError("Manifiesto de split no soportado")
    records = manifest.get("records")
    if not isinstance(records, list) or not records:
        raise ValueError("Manifiesto de split sin registros")
    return manifest


def load_rgb(path: Path, *, size: int) -> Image.Image:
    with Image.open(path) as image:
        return ImageOps.exif_transpose(image).convert("RGB").resize(
            (size, size),
            Image.Resampling.BILINEAR,
        )


def variant_targets(variant: str) -> np.ndarray:
    target = np.zeros(len(QUALITY_LABELS), dtype=np.float32)
    if variant != "clean":
        target[QUALITY_LABELS.index(variant)] = 1.0
    return target


def apply_synthetic_variant(
    image: Image.Image,
    variant: str,
    *,
    rng: np.random.Generator,
    transform_config: dict,
) -> Image.Image:
    if variant == "clean":
        return image
    if variant == "synthetic_blur":
        low, high = transform_config["blurRadius"]
        return image.filter(ImageFilter.GaussianBlur(radius=float(rng.uniform(low, high))))
    if variant == "synthetic_underexposure":
        low, high = transform_config["underexposureMultiplier"]
        return ImageEnhance.Brightness(image).enhance(float(rng.uniform(low, high)))
    if variant == "synthetic_overexposure":
        low, high = transform_config["overexposureWhiteBlend"]
        alpha = float(rng.uniform(low, high))
        return Image.blend(image, Image.new("RGB", image.size, "white"), alpha)
    if variant == "synthetic_occlusion":
        low, high = transform_config["occlusionAreaFraction"]
        target_area = float(rng.uniform(low, high)) * image.width * image.height
        aspect = float(rng.uniform(0.55, 1.8))
        width = min(image.width, max(1, round(math.sqrt(target_area * aspect))))
        height = min(image.height, max(1, round(target_area / width)))
        left = int(rng.integers(0, image.width - width + 1))
        top = int(rng.integers(0, image.height - height + 1))
        color = tuple(int(value) for value in rng.integers(0, 256, size=3))
        result = image.copy()
        result.paste(color, (left, top, left + width, top + height))
        return result
    raise ValueError(f"Variante sintetica desconocida: {variant}")


def apply_motion_blur(image: Image.Image, *, rng: np.random.Generator) -> Image.Image:
    values = np.asarray(image, dtype=np.float32)
    length = int(rng.choice((9, 13, 17)))
    angle = float(rng.uniform(0.0, math.pi))
    kernel = np.zeros((length, length), dtype=np.float32)
    center = (length - 1) / 2
    for offset in np.linspace(-center, center, length * 3):
        x = int(round(center + math.cos(angle) * offset))
        y = int(round(center + math.sin(angle) * offset))
        if 0 <= x < length and 0 <= y < length:
            kernel[y, x] = 1.0
    kernel /= max(float(kernel.sum()), 1.0)
    blurred = cv2.filter2D(values, -1, kernel, borderType=cv2.BORDER_REFLECT)
    return Image.fromarray(np.clip(blurred, 0, 255).astype(np.uint8), mode="RGB")


def image_tensor(image: Image.Image) -> np.ndarray:
    return np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 255.0


def deterministic_scores(image: Image.Image) -> np.ndarray:
    grayscale = np.asarray(ImageOps.grayscale(image), dtype=np.float32)
    laplacian_variance = float(cv2.Laplacian(grayscale, cv2.CV_32F).var())
    local_mean = cv2.boxFilter(grayscale, cv2.CV_32F, (15, 15), normalize=True)
    local_square_mean = cv2.boxFilter(
        grayscale * grayscale,
        cv2.CV_32F,
        (15, 15),
        normalize=True,
    )
    local_std = np.sqrt(np.maximum(local_square_mean - local_mean * local_mean, 0.0))
    return np.asarray(
        [
            -math.log1p(max(laplacian_variance, 0.0)),
            -float(grayscale.mean()),
            float(grayscale.mean()),
            float(np.mean(local_std < 2.5)),
        ],
        dtype=np.float64,
    )


def _confusion(
    labels: np.ndarray,
    scores: np.ndarray,
    threshold: float,
) -> dict[str, int]:
    expected = labels.astype(bool)
    predicted = scores >= threshold
    return {
        "fn": int(np.sum(expected & ~predicted)),
        "fp": int(np.sum(~expected & predicted)),
        "tn": int(np.sum(~expected & ~predicted)),
        "tp": int(np.sum(expected & predicted)),
    }


def metrics_at_threshold(
    labels: np.ndarray,
    scores: np.ndarray,
    threshold: float,
) -> dict[str, float | int]:
    counts = _confusion(labels, scores, threshold)
    tp, tn, fp, fn = (counts[name] for name in ("tp", "tn", "fp", "fn"))
    recall = tp / (tp + fn) if tp + fn else 0.0
    specificity = tn / (tn + fp) if tn + fp else 0.0
    precision = tp / (tp + fp) if tp + fp else 0.0
    return {
        **counts,
        "balancedAccuracy": (recall + specificity) / 2,
        "falsePositiveRate": 1.0 - specificity,
        "f1": (2 * precision * recall / (precision + recall)) if precision + recall else 0.0,
        "precision": precision,
        "recall": recall,
        "specificity": specificity,
        "threshold": float(threshold),
    }


def area_under_roc(labels: np.ndarray, scores: np.ndarray) -> float:
    positives = int(np.sum(labels == 1))
    negatives = int(np.sum(labels == 0))
    if not positives or not negatives:
        return 0.0
    order = np.argsort(-scores, kind="mergesort")
    ordered_labels = labels[order]
    ordered_scores = scores[order]
    boundaries = np.r_[np.flatnonzero(np.diff(ordered_scores)) + 1, len(scores)]
    true_positive = np.cumsum(ordered_labels)[boundaries - 1]
    false_positive = boundaries - true_positive
    tpr = np.r_[0.0, true_positive / positives]
    fpr = np.r_[0.0, false_positive / negatives]
    return float(np.trapezoid(tpr, fpr))


def average_precision(labels: np.ndarray, scores: np.ndarray) -> float:
    positives = int(np.sum(labels == 1))
    if not positives:
        return 0.0
    order = np.argsort(-scores, kind="mergesort")
    ordered = labels[order]
    cumulative = np.cumsum(ordered)
    ranks = np.arange(1, len(ordered) + 1)
    return float(np.sum((cumulative / ranks) * ordered) / positives)


def calibrate_threshold(
    labels: np.ndarray,
    scores: np.ndarray,
    *,
    maximum_false_positive_rate: float,
) -> float:
    if labels.shape != scores.shape or labels.ndim != 1:
        raise ValueError("labels y scores deben ser vectores del mismo tamano")
    if not np.all(np.isfinite(scores)):
        raise ValueError("scores debe contener solo valores finitos")
    reject_all = float(np.nextafter(float(np.max(scores)), math.inf))
    candidates = np.r_[reject_all, np.unique(scores)[::-1]]
    feasible = []
    for threshold in candidates:
        metrics = metrics_at_threshold(labels, scores, float(threshold))
        if metrics["falsePositiveRate"] <= maximum_false_positive_rate + 1e-12:
            feasible.append(metrics)
    chosen = max(
        feasible,
        key=lambda item: (
            item["recall"],
            item["balancedAccuracy"],
            -item["falsePositiveRate"],
            item["threshold"],
        ),
    )
    return float(chosen["threshold"])


def evaluate_score_matrix(
    labels: np.ndarray,
    scores: np.ndarray,
    thresholds: Sequence[float],
) -> dict:
    if labels.shape != scores.shape or labels.ndim != 2:
        raise ValueError("labels y scores deben ser matrices iguales")
    if labels.shape[1] != len(QUALITY_LABELS) or len(thresholds) != len(QUALITY_LABELS):
        raise ValueError("Cantidad de etiquetas de calidad inesperada")
    per_label = {}
    for index, label in enumerate(QUALITY_LABELS):
        metrics = metrics_at_threshold(labels[:, index], scores[:, index], thresholds[index])
        metrics["auprc"] = average_precision(labels[:, index], scores[:, index])
        metrics["auroc"] = area_under_roc(labels[:, index], scores[:, index])
        per_label[label] = metrics
    return {
        "macroAuprc": float(np.mean([value["auprc"] for value in per_label.values()])),
        "macroAuroc": float(np.mean([value["auroc"] for value in per_label.values()])),
        "macroBalancedAccuracy": float(
            np.mean([value["balancedAccuracy"] for value in per_label.values()])
        ),
        "perLabel": per_label,
    }


def percentile_interval(values: Iterable[float], *, confidence_level: float) -> dict:
    array = np.asarray(list(values), dtype=np.float64)
    if not len(array):
        raise ValueError("No hay valores para el intervalo")
    tail = (1.0 - confidence_level) / 2.0
    return {
        "confidenceLevel": confidence_level,
        "lower": float(np.quantile(array, tail)),
        "upper": float(np.quantile(array, 1.0 - tail)),
    }


def wilson_interval(
    successes: int,
    total: int,
    *,
    confidence_level: float,
) -> dict:
    if isinstance(successes, bool) or isinstance(total, bool):
        raise ValueError("successes y total deben ser enteros")
    if not 0 <= successes <= total or total <= 0:
        raise ValueError("Se requiere 0 <= successes <= total y total positivo")
    if not 0.0 < confidence_level < 1.0:
        raise ValueError("confidence_level debe estar entre 0 y 1")
    z = NormalDist().inv_cdf(0.5 + confidence_level / 2.0)
    proportion = successes / total
    denominator = 1.0 + z * z / total
    center = (proportion + z * z / (2.0 * total)) / denominator
    margin = (
        z
        * math.sqrt(
            proportion * (1.0 - proportion) / total
            + z * z / (4.0 * total * total)
        )
        / denominator
    )
    return {
        "confidenceLevel": confidence_level,
        "lower": max(0.0, center - margin),
        "rate": proportion,
        "successes": successes,
        "total": total,
        "upper": min(1.0, center + margin),
    }


def clean_control_alert_intervals(
    variants: Sequence[str] | np.ndarray,
    scores: np.ndarray,
    thresholds: Sequence[float],
    *,
    confidence_level: float,
) -> dict:
    """Measure alert burden on actual clean controls, never one-vs-rest rows.

    Other synthetic defects are not valid negatives for an operational false-alert
    rate: a different alert on a corrupted image may be useful.  This denominator
    is therefore restricted to rows registered as ``clean``.
    """
    variant_array = np.asarray(variants)
    threshold_array = np.asarray(thresholds, dtype=np.float64)
    if scores.ndim != 2 or scores.shape[1] != len(QUALITY_LABELS):
        raise ValueError("scores debe tener una columna por etiqueta de calidad")
    if len(variant_array) != scores.shape[0]:
        raise ValueError("Cada fila de scores requiere una variante")
    if threshold_array.shape != (len(QUALITY_LABELS),):
        raise ValueError("thresholds debe tener una entrada por etiqueta de calidad")
    if not np.all(np.isfinite(scores)) or not np.all(np.isfinite(threshold_array)):
        raise ValueError("scores y thresholds deben ser finitos")
    clean_mask = variant_array == "clean"
    clean_total = int(np.sum(clean_mask))
    if clean_total <= 0:
        raise ValueError("No hay controles limpios para medir falsas alertas")
    flags = scores[clean_mask] >= threshold_array
    return {
        "anyAlertOnCleanControl": wilson_interval(
            int(np.sum(np.any(flags, axis=1))),
            clean_total,
            confidence_level=confidence_level,
        ),
        "perLabelAlertOnCleanControl": {
            label: wilson_interval(
                int(np.sum(flags[:, index])),
                clean_total,
                confidence_level=confidence_level,
            )
            for index, label in enumerate(QUALITY_LABELS)
        },
    }


def validation_operating_metrics(
    variants: Sequence[str] | np.ndarray,
    scores: np.ndarray,
    thresholds: Sequence[float],
    *,
    confidence_level: float,
) -> dict:
    """Recompute all validation gates from row-level scores and registered variants."""
    variant_array = np.asarray(variants)
    threshold_array = np.asarray(thresholds, dtype=np.float64)
    clean_alerts = clean_control_alert_intervals(
        variant_array,
        scores,
        threshold_array,
        confidence_level=confidence_level,
    )
    per_label = {}
    for index, label in enumerate(QUALITY_LABELS):
        positive = variant_array == label
        positive_total = int(np.sum(positive))
        if positive_total <= 0:
            raise ValueError(f"No hay positivos registrados para {label}")
        per_label[label] = {
            "cleanFalseAlert": clean_alerts["perLabelAlertOnCleanControl"][label],
            "recall": wilson_interval(
                int(np.sum(scores[positive, index] >= threshold_array[index])),
                positive_total,
                confidence_level=confidence_level,
            ),
            "threshold": float(threshold_array[index]),
        }
    return {
        "anyAlertOnCleanControl": clean_alerts["anyAlertOnCleanControl"],
        "perLabel": per_label,
    }


def capture_quality_challenge_gate(
    validation: dict,
    challenge: dict,
) -> dict:
    """Decide whether a locked validation operating point may open a challenge.

    The decision deliberately uses clean controls for the false-alert denominator
    and the lower confidence bound for every registered synthetic defect.
    """
    any_alert = validation.get("anyAlertOnCleanControl")
    per_label = validation.get("perLabel")
    if not isinstance(any_alert, dict) or not isinstance(per_label, dict):
        raise ValueError("Metricas de validacion incompletas")
    minimum_images = int(challenge["minimumBaseImages"])
    maximum_upper = float(challenge["maximumAnyAlertWilsonUpperOnCleanControls"])
    minimum_recall = float(challenge["minimumPerDefectRecallWilsonLower"])
    clean_total = int(any_alert.get("total", 0))
    checks = {
        "minimumCleanControls": {
            "passed": clean_total >= minimum_images,
            "required": minimum_images,
            "value": clean_total,
        },
        "anyAlertOnCleanControlWilsonUpper": {
            "passed": float(any_alert["upper"]) <= maximum_upper,
            "requiredMaximum": maximum_upper,
            "value": float(any_alert["upper"]),
        },
        "perDefectRecallWilsonLower": {
            "passed": True,
            "requiredMinimum": minimum_recall,
            "values": {},
        },
    }
    recall_values = checks["perDefectRecallWilsonLower"]["values"]
    for label in QUALITY_LABELS:
        label_metrics = per_label.get(label)
        if not isinstance(label_metrics, dict) or not isinstance(label_metrics.get("recall"), dict):
            raise ValueError(f"Falta recall de validacion para {label}")
        lower = float(label_metrics["recall"]["lower"])
        recall_values[label] = lower
        if lower < minimum_recall:
            checks["perDefectRecallWilsonLower"]["passed"] = False
    eligible = all(check["passed"] for check in checks.values())
    return {
        "challengeEligible": eligible,
        "decision": "eligible-to-open" if eligible else "do-not-open",
        "gates": checks,
    }


def cluster_bootstrap_intervals(
    labels: np.ndarray,
    model_scores: np.ndarray,
    baseline_scores: np.ndarray,
    cluster_ids: Sequence[str],
    *,
    model_thresholds: Sequence[float],
    baseline_thresholds: Sequence[float],
    replicates: int,
    confidence_level: float,
    seed: int,
) -> dict:
    if labels.shape != model_scores.shape or labels.shape != baseline_scores.shape:
        raise ValueError("Las matrices del bootstrap deben tener el mismo tamano")
    if len(cluster_ids) != labels.shape[0]:
        raise ValueError("Cada fila debe tener cluster_id")
    if replicates <= 0:
        raise ValueError("bootstrapReplicates debe ser positivo")

    groups: dict[str, list[int]] = defaultdict(list)
    for index, cluster_id in enumerate(cluster_ids):
        groups[cluster_id].append(index)
    ordered_groups = sorted(groups)
    group_indexes = [np.asarray(groups[group], dtype=np.int64) for group in ordered_groups]
    rng = np.random.default_rng(seed)
    model_macro_auroc: list[float] = []
    model_macro_balanced_accuracy: list[float] = []
    baseline_macro_balanced_accuracy: list[float] = []
    paired_improvement: list[float] = []
    per_label_recall: dict[str, list[float]] = {label: [] for label in QUALITY_LABELS}

    for _ in range(replicates):
        sampled_groups = rng.integers(0, len(group_indexes), size=len(group_indexes))
        indexes = np.concatenate([group_indexes[index] for index in sampled_groups])
        model_metrics = evaluate_score_matrix(
            labels[indexes],
            model_scores[indexes],
            model_thresholds,
        )
        baseline_metrics = evaluate_score_matrix(
            labels[indexes],
            baseline_scores[indexes],
            baseline_thresholds,
        )
        model_macro_auroc.append(model_metrics["macroAuroc"])
        model_macro_balanced_accuracy.append(model_metrics["macroBalancedAccuracy"])
        baseline_macro_balanced_accuracy.append(
            baseline_metrics["macroBalancedAccuracy"]
        )
        paired_improvement.append(
            model_metrics["macroBalancedAccuracy"]
            - baseline_metrics["macroBalancedAccuracy"]
        )
        for label in QUALITY_LABELS:
            per_label_recall[label].append(model_metrics["perLabel"][label]["recall"])

    return {
        "baselineMacroBalancedAccuracy": percentile_interval(
            baseline_macro_balanced_accuracy,
            confidence_level=confidence_level,
        ),
        "modelMacroAuroc": percentile_interval(
            model_macro_auroc,
            confidence_level=confidence_level,
        ),
        "modelMacroBalancedAccuracy": percentile_interval(
            model_macro_balanced_accuracy,
            confidence_level=confidence_level,
        ),
        "pairedMacroBalancedAccuracyImprovement": percentile_interval(
            paired_improvement,
            confidence_level=confidence_level,
        ),
        "perLabelRecall": {
            label: percentile_interval(values, confidence_level=confidence_level)
            for label, values in per_label_recall.items()
        },
        "replicates": replicates,
        "samplingUnit": "perceptual_duplicate_cluster",
        "uniqueClusterCount": len(ordered_groups),
    }
