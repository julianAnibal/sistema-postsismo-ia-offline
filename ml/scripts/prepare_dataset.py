#!/usr/bin/env python3
"""Create governed splits with event-level leakage controls by default."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.dataset import (  # noqa: E402
    ALLOWED_GROUP_FIELDS,
    DEFAULT_GROUP_FIELDS,
    assert_no_group_leakage,
    grouped_split,
    read_jsonl,
    validate_dataset,
    write_jsonl,
)


def _parse_group_fields(value: str) -> tuple[str, ...]:
    fields = tuple(item.strip() for item in value.split(",") if item.strip())
    if not fields:
        raise argparse.ArgumentTypeError("--group-fields no puede estar vacio")
    unknown = [field for field in fields if field not in ALLOWED_GROUP_FIELDS]
    if unknown:
        raise argparse.ArgumentTypeError(
            f"campos no soportados: {unknown}; usa {list(ALLOWED_GROUP_FIELDS)}"
        )
    return fields


def print_json(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parte un JSONL aislando eventos completos por defecto"
    )
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "ml" / "artifacts" / "splits",
    )
    parser.add_argument("--seed", type=int, default=1000)
    parser.add_argument(
        "--group-fields",
        type=_parse_group_fields,
        default=DEFAULT_GROUP_FIELDS,
        help="event_id (seguro por defecto) o un agrupamiento heredado explicito",
    )
    parser.add_argument(
        "--allow-legacy-grouping",
        action="store_true",
        help="Acepta conscientemente una agrupacion mas debil que event_id",
    )
    args = parser.parse_args()

    if args.group_fields != DEFAULT_GROUP_FIELDS and not args.allow_legacy_grouping:
        raise SystemExit(
            "Un agrupamiento distinto de event_id requiere --allow-legacy-grouping"
        )

    records = read_jsonl(args.input)
    validation = validate_dataset(records)
    if not validation["valid"]:
        print_json(validation)
        raise SystemExit(1)

    try:
        splits = grouped_split(records, seed=args.seed, group_fields=args.group_fields)
        leakage = assert_no_group_leakage(splits, group_fields=args.group_fields)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    for name, rows in splits.items():
        write_jsonl(args.output / f"{name}.jsonl", rows)

    print_json(
        {
            "output": str(args.output),
            "group_fields": list(args.group_fields),
            "splits": {name: len(rows) for name, rows in splits.items()},
            "leakage": leakage,
        }
    )


if __name__ == "__main__":
    main()
