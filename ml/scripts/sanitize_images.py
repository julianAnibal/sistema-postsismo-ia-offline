# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=11.2"]
# ///
"""Remove image metadata and create a mandatory visual privacy review queue."""
from __future__ import annotations

import argparse
import csv
import hashlib
from pathlib import Path

from PIL import Image, ImageOps


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = []
    for source in sorted(args.input.rglob("*")):
        if source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        target = args.output / f"{hashlib.sha256(str(source).encode()).hexdigest()[:16]}.jpg"
        with Image.open(source) as image:
            clean = ImageOps.exif_transpose(image).convert("RGB")
            clean.save(target, "JPEG", quality=92, optimize=True, exif=b"")
        rows.append({
            "source_name": source.name, "sanitized_name": target.name, "sha256": digest(target),
            "faces_checked": "NO", "plates_checked": "NO", "documents_checked": "NO", "approved_for_training": "NO",
        })
    queue = args.output / "privacy-review.csv"
    fieldnames = list(rows[0]) if rows else ["source_name"]
    with queue.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Imagenes saneadas: {len(rows)}")
    print(f"Revision humana obligatoria: {queue}")


if __name__ == "__main__":
    main()
