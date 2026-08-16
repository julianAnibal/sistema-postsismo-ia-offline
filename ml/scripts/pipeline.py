#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.dataset import (  # noqa: E402
    assert_no_group_leakage,
    grouped_split,
    read_jsonl,
    validate_dataset,
    write_jsonl,
)
from mil_ojos_ml.evaluation import evaluate_predictions  # noqa: E402
from mil_ojos_ml.model_pack import build_manifest  # noqa: E402

DEMO_DATA = ROOT / "ml" / "data" / "demo" / "sft.jsonl"
DEFAULT_OUTPUT = ROOT / "ml" / "artifacts" / "demo"


def print_json(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def validate_command(path: Path) -> dict:
    report = validate_dataset(read_jsonl(path))
    print_json(report)
    if not report["valid"]:
        raise SystemExit(1)
    return report


def split_command(path: Path, output: Path, seed: int) -> dict[str, list[dict]]:
    records = read_jsonl(path)
    report = validate_dataset(records)
    if not report["valid"]:
        print_json(report)
        raise SystemExit(1)
    splits = grouped_split(records, seed=seed)
    assert_no_group_leakage(splits)
    for name, rows in splits.items():
        write_jsonl(output / f"{name}.jsonl", rows)
    summary = {name: len(rows) for name, rows in splits.items()}
    print_json({"output": str(output), "splits": summary, "leakage": False})
    return splits


def prepare_sft(splits: dict[str, list[dict]], output: Path) -> None:
    for name, rows in splits.items():
        prepared = [{"messages": row["messages"], "record_id": row["record_id"]} for row in rows]
        write_jsonl(output / "sft" / f"{name}.jsonl", prepared)


def demo_command(output: Path) -> None:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    report = validate_dataset(read_jsonl(DEMO_DATA))
    if not report["valid"]:
        print_json(report)
        raise SystemExit(1)
    splits = split_command(DEMO_DATA, output / "splits", seed=1000)
    prepare_sft(splits, output)

    predictions = []
    for record in splits["test"]:
        predictions.append({"record_id": record["record_id"], "prediction": record["messages"][-1]["content"]})
    write_jsonl(output / "predictions.jsonl", predictions)
    evaluation = evaluate_predictions(output / "predictions.jsonl")
    print_json({"evaluation": evaluation})
    if not evaluation["passed"]:
        raise SystemExit(1)

    placeholder = output / "model.placeholder"
    placeholder.write_text("DEMO ONLY - NOT A MODEL\n", encoding="utf-8")
    manifest = build_manifest(
        placeholder,
        output / "model-pack.json",
        model_id="1000-ojos-demo",
        version="0.0.0-demo",
        runtime="litert-lm",
    )
    print_json({"manifest": manifest, "demo_only": True})


def main() -> None:
    parser = argparse.ArgumentParser(description="Recorrido de entrenamiento de 1000 ojos")
    subparsers = parser.add_subparsers(dest="command", required=True)
    demo = subparsers.add_parser("demo", help="Ejecuta el recorrido sin GPU")
    demo.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    validate = subparsers.add_parser("validate", help="Valida JSONL revisado")
    validate.add_argument("--input", type=Path, required=True)
    split = subparsers.add_parser("split", help="Crea particiones sin fuga")
    split.add_argument("--input", type=Path, required=True)
    split.add_argument("--output", type=Path, default=ROOT / "ml" / "artifacts" / "splits")
    split.add_argument("--seed", type=int, default=1000)
    args = parser.parse_args()
    if args.command == "demo":
        demo_command(args.output)
    elif args.command == "validate":
        validate_command(args.input)
    elif args.command == "split":
        split_command(args.input, args.output, args.seed)


if __name__ == "__main__":
    main()
