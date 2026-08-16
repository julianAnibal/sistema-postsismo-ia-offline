# /// script
# requires-python = ">=3.11"
# dependencies = ["trackio>=0.2", "ultralytics>=8.3"]
# ///
"""Train a compact damage segmentation model from a YOLO dataset."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import trackio
from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="YOLO dataset YAML")
    parser.add_argument("--model", default="yolo11n-seg.pt")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--output", default="vision-output")
    args = parser.parse_args()
    trackio.init(project="1000-ojos", name="damage-segmentation")
    model = YOLO(args.model)
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        seed=1000,
        deterministic=True,
        project=args.output,
        name="damage-segmentation",
        exist_ok=True,
    )
    metrics = {
        "results_dict": {str(key): float(value) for key, value in results.results_dict.items()},
        "warning": "Las predicciones son sugerencias y requieren revision profesional.",
    }
    path = Path(args.output) / "training-metrics.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8")
    trackio.log(metrics["results_dict"])
    trackio.finish()


if __name__ == "__main__":
    main()
