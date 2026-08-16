#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import QUALITY_LABELS, wilson_interval  # noqa: E402
from mil_ojos_ml.capture_quality_model import load_json  # noqa: E402
from mil_ojos_ml.provenance import sha256  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Supersede una puerta diluida con FPR sobre controles limpios"
    )
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()

    report_path = args.candidate / "TEST-REPORT.json"
    scores_path = args.candidate / "test-scores.npz"
    output = args.candidate / "TEST-REPORT-AUDIT.json"
    if output.exists():
        raise SystemExit("La auditoria ya existe y es inmutable")
    report = load_json(report_path)
    candidate = load_json(args.candidate / "candidate.json")
    scores = np.load(scores_path)
    variants = scores["variants"]
    model_scores = scores["model_scores"]
    clean = variants == "clean"
    if int(np.sum(clean)) <= 0:
        raise SystemExit("No hay controles limpios en el test")
    thresholds = np.asarray(candidate["thresholds"]["model"], dtype=np.float64)
    flags = model_scores[clean] >= thresholds
    confidence_level = 0.95
    per_label = {
        label: wilson_interval(
            int(np.sum(flags[:, index])),
            len(flags),
            confidence_level=confidence_level,
        )
        for index, label in enumerate(QUALITY_LABELS)
    }
    any_flag = wilson_interval(
        int(np.sum(np.any(flags, axis=1))),
        len(flags),
        confidence_level=confidence_level,
    )
    audit = {
        "schemaVersion": 1,
        "auditId": "CQ-AUDIT-001",
        "auditedAt": datetime.now(UTC).isoformat(),
        "candidateSha256": sha256(args.candidate / "candidate.json"),
        "correctedDecision": {
            "developmentGatesPassed": False,
            "modelReleased": False,
            "selectedImplementation": "none",
            "status": "superseded-no-go",
        },
        "discovery": {
            "anyAlertOnCleanControl": any_flag,
            "perLabelAlertOnCleanControl": per_label,
        },
        "issue": (
            "The original one-vs-rest false-positive denominator included other "
            "synthetic defect variants. That diluted the operationally relevant rate: "
            "a repeat-capture alert on an untransformed clean control."
        ),
        "originalDecision": {
            "developmentGatesPassed": report["developmentGatesPassed"],
            "selectedImplementation": report["selectedImplementation"],
        },
        "originalReportPreserved": True,
        "originalReportSha256": sha256(report_path),
        "requiredNextGate": (
            "Lock thresholds on validation controls and require the Wilson 95% upper "
            "bound for any alert on clean controls to be <= 0.05 on a new sealed test."
        ),
        "scopeThatStillHolds": (
            "The candidate discriminates the registered synthetic transformations in "
            "this source benchmark; it is not a usable capture-quality operating point."
        ),
        "supersedesOriginalAutomatedDecision": True,
    }
    output.write_text(
        json.dumps(audit, allow_nan=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(audit, allow_nan=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
