from __future__ import annotations

import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

REQUIRED_OUTPUT_FIELDS = {
    "summary",
    "missing_fields",
    "requires_expert_review",
    "source_ids",
}
ALLOWED_ROLES = ("system", "user", "assistant")
PII_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "phone": re.compile(r"(?<!\d)(?:\+?57\s?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)"),
    "document": re.compile(r"\b(?:CC|CEDULA|DOCUMENTO)\s*[:#-]?\s*\d{6,12}\b", re.I),
}
PROHIBITED_VERDICTS = re.compile(
    r"\b(?:edificio|estructura|vivienda)\s+(?:es|esta)\s+(?:segur[oa]|habitable|inhabitable)\b",
    re.I,
)


def read_jsonl(path: Path) -> list[dict]:
    records: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: JSON invalido: {exc.msg}") from exc
    return records


def write_jsonl(path: Path, records: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def validate_record(record: dict) -> list[str]:
    errors: list[str] = []
    record_id = record.get("record_id", "<sin-id>")
    for field in ("record_id", "event_id", "infrastructure_id", "task", "messages", "review"):
        if not record.get(field):
            errors.append(f"{record_id}: falta {field}")

    messages = record.get("messages")
    if not isinstance(messages, list) or len(messages) != 3:
        errors.append(f"{record_id}: messages debe contener system, user y assistant")
        return errors
    roles = tuple(message.get("role") for message in messages)
    if roles != ALLOWED_ROLES:
        errors.append(f"{record_id}: secuencia de roles invalida: {roles}")

    all_text = "\n".join(str(message.get("content", "")) for message in messages)
    for label, pattern in PII_PATTERNS.items():
        if pattern.search(all_text):
            errors.append(f"{record_id}: posible PII ({label})")

    assistant_text = str(messages[-1].get("content", ""))
    if PROHIBITED_VERDICTS.search(assistant_text):
        errors.append(f"{record_id}: contiene dictamen prohibido")
    try:
        output = json.loads(assistant_text)
    except json.JSONDecodeError:
        errors.append(f"{record_id}: salida assistant no es JSON")
    else:
        missing = REQUIRED_OUTPUT_FIELDS - set(output)
        if missing:
            errors.append(f"{record_id}: faltan campos de salida: {sorted(missing)}")
        if output.get("requires_expert_review") is not True:
            errors.append(f"{record_id}: requires_expert_review debe ser true")
        if not isinstance(output.get("missing_fields"), list):
            errors.append(f"{record_id}: missing_fields debe ser lista")
        if not isinstance(output.get("source_ids"), list):
            errors.append(f"{record_id}: source_ids debe ser lista")

    review = record.get("review", {})
    if review.get("status") != "approved":
        errors.append(f"{record_id}: ejemplo no aprobado")
    if review.get("reviewer_role") != "structural_engineer":
        errors.append(f"{record_id}: requiere revision de ingenieria estructural")
    if int(review.get("review_count", 0)) < 2:
        errors.append(f"{record_id}: requiere al menos dos revisiones")
    return errors


def validate_dataset(records: list[dict]) -> dict:
    errors = [error for record in records for error in validate_record(record)]
    duplicate_ids = [key for key, count in Counter(r.get("record_id") for r in records).items() if count > 1]
    errors.extend(f"record_id duplicado: {record_id}" for record_id in duplicate_ids)
    return {
        "valid": not errors,
        "record_count": len(records),
        "event_count": len({r.get("event_id") for r in records}),
        "infrastructure_count": len({r.get("infrastructure_id") for r in records}),
        "task_counts": dict(sorted(Counter(r.get("task") for r in records).items())),
        "errors": errors,
    }


def grouped_split(records: list[dict], seed: int = 1000) -> dict[str, list[dict]]:
    """Split by event and infrastructure, preventing evidence leakage."""
    grouped: dict[str, list[dict]] = {}
    for record in records:
        key = f"{record['event_id']}::{record['infrastructure_id']}"
        grouped.setdefault(key, []).append(record)
    keys = sorted(grouped)
    random.Random(seed).shuffle(keys)
    count = len(keys)
    train_end = max(1, round(count * 0.67))
    validation_end = max(train_end + 1, round(count * 0.84)) if count >= 3 else train_end
    split_keys = {
        "train": keys[:train_end],
        "validation": keys[train_end:validation_end],
        "test": keys[validation_end:],
    }
    if count >= 3:
        for name in ("validation", "test"):
            if not split_keys[name]:
                donor = "train" if len(split_keys["train"]) > 1 else "validation"
                split_keys[name].append(split_keys[donor].pop())
    return {name: [record for key in group_keys for record in grouped[key]] for name, group_keys in split_keys.items()}


def assert_no_group_leakage(splits: dict[str, list[dict]]) -> None:
    seen: dict[str, str] = {}
    for split_name, records in splits.items():
        for record in records:
            key = f"{record['event_id']}::{record['infrastructure_id']}"
            previous = seen.setdefault(key, split_name)
            if previous != split_name:
                raise ValueError(f"fuga de grupo {key}: {previous} y {split_name}")


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
