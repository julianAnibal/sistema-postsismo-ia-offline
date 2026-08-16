import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    SourceRecord,
    area_under_roc,
    assign_cluster_splits,
    average_precision,
    calibrate_threshold,
    capture_quality_challenge_gate,
    clean_control_alert_intervals,
    metrics_at_threshold,
    perceptual_duplicate_clusters,
    stable_seed,
    validation_operating_metrics,
    variant_targets,
    wilson_interval,
)


def record(identifier: str, phash: int, nuisance_label: str = "Negative") -> SourceRecord:
    return SourceRecord(
        record_id=identifier,
        path=Path(identifier),
        nuisance_label=nuisance_label,
        sha256=hashlib.sha256(identifier.encode()).hexdigest(),
        phash=phash,
    )


class CaptureQualityTest(unittest.TestCase):
    def test_stable_seed_is_repeatable_and_order_sensitive(self):
        self.assertEqual(stable_seed(1000, "a"), stable_seed(1000, "a"))
        self.assertNotEqual(stable_seed(1000, "a"), stable_seed("a", 1000))

    def test_perceptual_clustering_groups_hamming_four_but_not_five(self):
        values = [
            record("a", 0),
            record("b", 0b1111),
            record("c", 0b1_1111 << 8),
        ]
        clusters = perceptual_duplicate_clusters(values, maximum_hamming_distance=4)
        self.assertEqual(clusters[0], clusters[1])
        self.assertNotEqual(clusters[0], clusters[2])

    def test_cluster_split_has_no_cluster_overlap(self):
        records = [
            record(f"n-{index}", index, "Negative") for index in range(9)
        ] + [record(f"p-{index}", index + 100, "Positive") for index in range(9)]
        clusters = [f"cluster-{index // 2}" for index in range(len(records))]
        splits = assign_cluster_splits(
            records,
            clusters,
            ratios={"train": 0.6, "validation": 0.2, "test": 0.2},
            seed=1000,
        )
        by_cluster = {}
        for cluster, split in zip(clusters, splits, strict=True):
            by_cluster.setdefault(cluster, set()).add(split)
        self.assertTrue(all(len(value) == 1 for value in by_cluster.values()))
        self.assertEqual(set(splits), {"train", "validation", "test"})

    def test_threshold_respects_false_positive_constraint(self):
        labels = np.asarray([1, 1, 0, 0], dtype=np.int64)
        scores = np.asarray([0.9, 0.8, 0.7, 0.1], dtype=np.float64)
        threshold = calibrate_threshold(
            labels,
            scores,
            maximum_false_positive_rate=0.0,
        )
        metrics = metrics_at_threshold(labels, scores, threshold)
        self.assertEqual(metrics["falsePositiveRate"], 0.0)
        self.assertEqual(metrics["recall"], 1.0)

    def test_reject_all_threshold_remains_finite_json(self):
        labels = np.asarray([1, 0, 0], dtype=np.int64)
        scores = np.asarray([0.0, 1.0, 1.0], dtype=np.float64)
        threshold = calibrate_threshold(
            labels,
            scores,
            maximum_false_positive_rate=0.0,
        )
        self.assertTrue(np.isfinite(threshold))
        self.assertGreater(threshold, 1.0)
        self.assertEqual(metrics_at_threshold(labels, scores, threshold)["recall"], 0.0)

    def test_auc_and_average_precision_are_one_for_perfect_ranking(self):
        labels = np.asarray([1, 1, 0, 0], dtype=np.int64)
        scores = np.asarray([0.9, 0.8, 0.2, 0.1], dtype=np.float64)
        self.assertEqual(area_under_roc(labels, scores), 1.0)
        self.assertEqual(average_precision(labels, scores), 1.0)

    def test_variant_targets_are_multilabel_safe(self):
        self.assertEqual(float(variant_targets("clean").sum()), 0.0)
        target = variant_targets("synthetic_blur")
        self.assertEqual(float(target.sum()), 1.0)
        self.assertEqual(float(target[0]), 1.0)

    def test_wilson_interval_contains_observed_rate(self):
        interval = wilson_interval(5, 100, confidence_level=0.95)
        self.assertLess(interval["lower"], 0.05)
        self.assertGreater(interval["upper"], 0.05)
        self.assertEqual(interval["rate"], 0.05)

    def test_clean_control_alert_rate_never_uses_other_defects_as_negatives(self):
        variants = np.asarray(["clean", "clean", "synthetic_blur"])
        scores = np.asarray(
            [
                [0.1, 0.1, 0.1, 0.1],
                [0.9, 0.1, 0.1, 0.1],
                [0.1, 0.9, 0.9, 0.9],
            ],
            dtype=np.float64,
        )
        result = clean_control_alert_intervals(
            variants,
            scores,
            [0.5, 0.5, 0.5, 0.5],
            confidence_level=0.95,
        )
        any_alert = result["anyAlertOnCleanControl"]
        self.assertEqual(any_alert["successes"], 1)
        self.assertEqual(any_alert["total"], 2)
        self.assertEqual(any_alert["rate"], 0.5)
        self.assertEqual(
            result["perLabelAlertOnCleanControl"]["synthetic_underexposure"]["successes"],
            0,
        )

    def test_validation_metrics_bind_clean_alerts_and_each_defect_recall(self):
        variants = np.asarray(
            ["clean", "clean", "synthetic_blur", "synthetic_underexposure",
             "synthetic_overexposure", "synthetic_occlusion"]
        )
        scores = np.zeros((6, 4), dtype=np.float64)
        scores[1, 0] = 0.9
        for index in range(4):
            scores[index + 2, index] = 0.9
        result = validation_operating_metrics(
            variants,
            scores,
            [0.5] * 4,
            confidence_level=0.95,
        )
        self.assertEqual(result["anyAlertOnCleanControl"]["successes"], 1)
        self.assertEqual(result["anyAlertOnCleanControl"]["total"], 2)
        for label in (
            "synthetic_blur",
            "synthetic_underexposure",
            "synthetic_overexposure",
            "synthetic_occlusion",
        ):
            self.assertEqual(result["perLabel"][label]["recall"]["successes"], 1)
            self.assertEqual(result["perLabel"][label]["recall"]["total"], 1)

    def test_challenge_gate_blocks_weak_recall_on_one_registered_defect(self):
        validation = {
            "anyAlertOnCleanControl": {"total": 1200, "upper": 0.02},
            "perLabel": {
                label: {"recall": {"lower": 0.95}}
                for label in (
                    "synthetic_blur",
                    "synthetic_underexposure",
                    "synthetic_overexposure",
                    "synthetic_occlusion",
                )
            },
        }
        validation["perLabel"]["synthetic_overexposure"]["recall"]["lower"] = 0.52
        decision = capture_quality_challenge_gate(
            validation,
            {
                "minimumBaseImages": 1000,
                "maximumAnyAlertWilsonUpperOnCleanControls": 0.05,
                "minimumPerDefectRecallWilsonLower": 0.9,
            },
        )
        self.assertFalse(decision["challengeEligible"])
        self.assertEqual(decision["decision"], "do-not-open")
        self.assertFalse(decision["gates"]["perDefectRecallWilsonLower"]["passed"])

    def test_challenge_gate_passes_only_when_every_gate_passes(self):
        validation = {
            "anyAlertOnCleanControl": {"total": 1200, "upper": 0.02},
            "perLabel": {
                label: {"recall": {"lower": 0.95}}
                for label in (
                    "synthetic_blur",
                    "synthetic_underexposure",
                    "synthetic_overexposure",
                    "synthetic_occlusion",
                )
            },
        }
        decision = capture_quality_challenge_gate(
            validation,
            {
                "minimumBaseImages": 1000,
                "maximumAnyAlertWilsonUpperOnCleanControls": 0.05,
                "minimumPerDefectRecallWilsonLower": 0.9,
            },
        )
        self.assertTrue(decision["challengeEligible"])
        self.assertEqual(decision["decision"], "eligible-to-open")


if __name__ == "__main__":
    unittest.main()
