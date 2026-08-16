#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.capture_quality import (  # noqa: E402
    assign_cluster_splits,
    discover_source_records,
    perceptual_duplicate_clusters,
    write_split_manifest,
)
from mil_ojos_ml.provenance import read_provenance, sha256  # noqa: E402

DEFAULT_CONFIG = ROOT / "ml" / "config" / "capture_quality_v1.json"
DEFAULT_PROVENANCE = (
    ROOT
    / "ml"
    / "data"
    / "provenance"
    / "concrete-crack-images-validation-v1.json"
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Registra hashes y separa imagenes base antes de corrupciones sinteticas"
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--provenance", type=Path, default=DEFAULT_PROVENANCE)
    parser.add_argument(
        "--source",
        type=Path,
        default=ROOT / "private-data" / "capture-quality" / "source" / "validation",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "private-data" / "capture-quality" / "split-v1.json",
    )
    args = parser.parse_args()

    if args.output.exists():
        raise SystemExit("El manifiesto de split ya existe y es inmutable")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    provenance = read_provenance(args.provenance)
    records = discover_source_records(args.source)
    expected = provenance["expected"]["imageCount"]
    if len(records) != expected:
        raise SystemExit(f"Se esperaban {expected} imagenes y se encontraron {len(records)}")

    maximum_hamming_distance = config["split"][
        "maximumPerceptualHashHammingDistance"
    ]
    clusters = perceptual_duplicate_clusters(
        records,
        maximum_hamming_distance=maximum_hamming_distance,
    )
    splits = assign_cluster_splits(
        records,
        clusters,
        ratios=config["split"]["ratios"],
        seed=config["seed"],
    )
    manifest = write_split_manifest(
        args.output,
        source_root=args.source,
        records=records,
        clusters=clusters,
        splits=splits,
        source_provenance_sha256=sha256(args.provenance),
        config_sha256=sha256(args.config),
        maximum_hamming_distance=maximum_hamming_distance,
        seed=config["seed"],
    )
    print(json.dumps(manifest["summary"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
