#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.provenance import (  # noqa: E402
    download_verified,
    extract_zip_atomic,
    read_provenance,
    verify_artifact,
)

DEFAULT_MANIFEST = (
    ROOT
    / "ml"
    / "data"
    / "provenance"
    / "concrete-crack-images-validation-v1.json"
)
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def image_inventory(root: Path) -> dict:
    images = sorted(
        path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )
    labels = Counter()
    for path in images:
        for part in path.relative_to(root).parts[:-1]:
            if part.lower() in {"negative", "positive"}:
                labels[part.capitalize()] += 1
                break
    return {"imageCount": len(images), "labels": dict(sorted(labels.items()))}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descarga y verifica el corpus registrado para calidad de captura"
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=ROOT / "private-data" / "capture-quality" / "source",
    )
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    provenance = read_provenance(args.manifest)
    artifact = provenance["artifact"]
    dataset = provenance["dataset"]
    archive = args.output_root / Path(artifact["path"]).name
    extracted = args.output_root / "validation"
    url = (
        f"https://huggingface.co/datasets/{dataset['id']}/resolve/"
        f"{dataset['revision']}/{artifact['path']}?download=true"
    )

    if args.verify_only:
        verify_artifact(
            archive,
            expected_size=artifact["byteSize"],
            expected_sha256=artifact["sha256"],
        )
    else:
        download_verified(
            url,
            archive,
            expected_size=artifact["byteSize"],
            expected_sha256=artifact["sha256"],
        )
        if not extracted.exists():
            extract_zip_atomic(
                archive,
                extracted,
                maximum_uncompressed_bytes=500_000_000,
            )

    inventory = image_inventory(extracted) if extracted.exists() else None
    if inventory and inventory["imageCount"] != provenance["expected"]["imageCount"]:
        raise SystemExit(
            f"Inventario inesperado: {inventory['imageCount']} imagenes; "
            f"esperadas {provenance['expected']['imageCount']}"
        )
    print(
        json.dumps(
            {
                "archive": str(archive),
                "datasetRevision": dataset["revision"],
                "extracted": str(extracted) if extracted.exists() else None,
                "inventory": inventory,
                "license": provenance["license"]["spdx"],
                "sha256": artifact["sha256"],
                "verified": True,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
