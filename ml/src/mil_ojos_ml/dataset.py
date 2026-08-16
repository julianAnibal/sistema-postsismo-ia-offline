from __future__ import annotations

import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

from jsonschema import Draft202012Validator

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
    r"\b(?:"
    r"(?:edificio|estructura|vivienda)\s+(?:es|est[aá])\s+(?:segur[oa]|habitable|inhabitable)"
    r"|(?:se\s+)?puede\s+(?:habitar|ingresar|entrar)"
    r"|no\s+(?:vuelva|debe)\s+(?:a\s+)?(?:entrar|ingresar)"
    r"|evac(?:uar|úe|ue|uación|uacion)"
    r")\b",
    re.I,
)


def contains_prohibited_verdict(value: object) -> bool:
    candidates = [str(value)]
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            decoded = None
        if decoded is not None:
            candidates.append(json.dumps(decoded, ensure_ascii=False))
    else:
        candidates.append(json.dumps(value, ensure_ascii=False))
    return any(PROHIBITED_VERDICTS.search(candidate) for candidate in candidates)

ALLOWED_GROUP_FIELDS = ("event_id", "infrastructure_id")
DEFAULT_GROUP_FIELDS: tuple[str, ...] = ("event_id",)
LEGACY_GROUP_FIELDS: tuple[str, ...] = ("event_id", "infrastructure_id")

LANGUAGE_RECORD_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schemas" / "language-record.schema.json"
)
LANGUAGE_RECORD_SCHEMA = json.loads(
    LANGUAGE_RECORD_SCHEMA_PATH.read_text(encoding="utf-8")
)
LANGUAGE_RECORD_VALIDATOR = Draft202012Validator(LANGUAGE_RECORD_SCHEMA)


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
    if not isinstance(record, dict):
        return ["<sin-id>: el registro debe ser un objeto JSON"]
    errors: list[str] = []
    record_id = record.get("record_id", "<sin-id>")
    for schema_error in sorted(
        LANGUAGE_RECORD_VALIDATOR.iter_errors(record),
        key=lambda error: (list(error.absolute_path), error.message),
    ):
        location = ".".join(str(part) for part in schema_error.absolute_path) or "<raiz>"
        errors.append(
            f"{record_id}: schema {location}: {schema_error.message}"
        )
    for field in ("record_id", "event_id", "infrastructure_id", "task"):
        if not isinstance(record.get(field), str) or not record[field].strip():
            errors.append(f"{record_id}: {field} debe ser una cadena no vacia")

    messages = record.get("messages")
    if not isinstance(messages, list) or len(messages) != 3:
        errors.append(f"{record_id}: messages debe contener system, user y assistant")
        return errors
    if not all(isinstance(message, dict) for message in messages):
        errors.append(f"{record_id}: cada mensaje debe ser un objeto")
        return errors
    roles = tuple(message.get("role") for message in messages)
    if roles != ALLOWED_ROLES:
        errors.append(f"{record_id}: secuencia de roles invalida: {roles}")
    if any(not isinstance(message.get("content"), str) for message in messages):
        errors.append(f"{record_id}: cada content debe ser una cadena")

    all_text = "\n".join(str(message.get("content", "")) for message in messages)
    for label, pattern in PII_PATTERNS.items():
        if pattern.search(all_text):
            errors.append(f"{record_id}: posible PII ({label})")

    assistant_text = str(messages[-1].get("content", ""))
    if contains_prohibited_verdict(assistant_text):
        errors.append(f"{record_id}: contiene dictamen prohibido")
    try:
        output = json.loads(assistant_text)
    except json.JSONDecodeError:
        errors.append(f"{record_id}: salida assistant no es JSON")
    else:
        if not isinstance(output, dict):
            errors.append(f"{record_id}: salida assistant debe ser un objeto JSON")
        else:
            if set(output) != REQUIRED_OUTPUT_FIELDS:
                errors.append(
                    f"{record_id}: campos de salida deben ser {sorted(REQUIRED_OUTPUT_FIELDS)}"
                )
            if not isinstance(output.get("summary"), str) or not output["summary"].strip():
                errors.append(f"{record_id}: summary debe ser una cadena no vacia")
            if output.get("requires_expert_review") is not True:
                errors.append(f"{record_id}: requires_expert_review debe ser true")
            missing_fields = output.get("missing_fields")
            if not isinstance(missing_fields, list) or not all(
                isinstance(item, str) and item.strip() for item in missing_fields
            ):
                errors.append(f"{record_id}: missing_fields debe ser lista de cadenas")
            source_ids = output.get("source_ids")
            if (
                not isinstance(source_ids, list)
                or not all(isinstance(item, str) and item.strip() for item in source_ids)
                or len(source_ids) != len(set(source_ids))
            ):
                errors.append(f"{record_id}: source_ids debe ser lista unica de cadenas")

    review = record.get("review")
    if not isinstance(review, dict):
        errors.append(f"{record_id}: review debe ser un objeto")
        return errors
    if review.get("status") != "approved":
        errors.append(f"{record_id}: ejemplo no aprobado")
    if review.get("reviewer_role") != "structural_engineer":
        errors.append(f"{record_id}: requiere revision de ingenieria estructural")
    review_count = review.get("review_count")
    if isinstance(review_count, bool) or not isinstance(review_count, int) or review_count < 2:
        errors.append(f"{record_id}: requiere al menos dos revisiones")
    return errors


def validate_dataset(records: list[dict]) -> dict:
    errors = [error for record in records for error in validate_record(record)]
    if not records:
        errors.append("dataset vacio")
    object_records = [record for record in records if isinstance(record, dict)]
    record_ids = [record.get("record_id") for record in object_records]
    duplicate_ids = [
        key
        for key, count in Counter(
            value for value in record_ids if isinstance(value, str)
        ).items()
        if count > 1
    ]
    errors.extend(f"record_id duplicado: {record_id}" for record_id in duplicate_ids)
    return {
        "valid": not errors,
        "record_count": len(records),
        "event_count": len(
            {record.get("event_id") for record in object_records if isinstance(record.get("event_id"), str)}
        ),
        "infrastructure_count": len(
            {
                record.get("infrastructure_id")
                for record in object_records
                if isinstance(record.get("infrastructure_id"), str)
            }
        ),
        "task_counts": dict(
            sorted(
                Counter(
                    record.get("task")
                    for record in object_records
                    if isinstance(record.get("task"), str)
                ).items()
            )
        ),
        "errors": errors,
    }


def assert_unique_record_ids(records: list[dict]) -> None:
    record_ids = [record.get("record_id") for record in records]
    if any(not isinstance(record_id, str) or not record_id for record_id in record_ids):
        raise ValueError("cada registro requiere record_id antes de partir")
    duplicates = sorted(
        record_id for record_id, count in Counter(record_ids).items() if count > 1
    )
    if duplicates:
        raise ValueError(f"record_id duplicado antes de partir: {duplicates}")


def _validate_group_fields(group_fields: tuple[str, ...]) -> tuple[str, ...]:
    if not group_fields:
        raise ValueError("group_fields no puede estar vacio")
    normalized: list[str] = []
    for field in group_fields:
        if field not in ALLOWED_GROUP_FIELDS:
            raise ValueError(
                f"campo de grupo no soportado: {field!r}. Usa uno de {list(ALLOWED_GROUP_FIELDS)}"
            )
        if field in normalized:
            raise ValueError(f"campo de grupo duplicado: {field!r}")
        normalized.append(field)
    return tuple(normalized)


def _group_key(record: dict, group_fields: tuple[str, ...]) -> str:
    parts: list[str] = []
    for field in group_fields:
        if field not in record or record[field] in (None, ""):
            raise ValueError(
                f"registro {record.get('record_id', '<sin-id>')} sin valor para {field}"
            )
        parts.append(str(record[field]))
    return "::".join(parts)


def grouped_split(
    records: list[dict],
    seed: int = 1000,
    group_fields: tuple[str, ...] = DEFAULT_GROUP_FIELDS,
) -> dict[str, list[dict]]:
    """Split records so no chosen group appears in more than one partition.

    The default isolates complete seismic events. Passing
    ``LEGACY_GROUP_FIELDS`` explicitly preserves the older
    event-and-infrastructure grouping for comparison runs.
    """
    assert_unique_record_ids(records)
    fields = _validate_group_fields(group_fields)
    grouped: dict[str, list[dict]] = {}
    for record in records:
        key = _group_key(record, fields)
        grouped.setdefault(key, []).append(record)
    keys = sorted(grouped)
    if len(keys) < 3:
        raise ValueError("se requieren al menos tres grupos para train, validation y test")
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
    return {
        name: [record for key in group_keys for record in grouped[key]]
        for name, group_keys in split_keys.items()
    }


def leakage_report(
    splits: dict[str, list[dict]],
    group_fields: tuple[str, ...] = DEFAULT_GROUP_FIELDS,
) -> dict:
    """Return auditable group membership and any overlap between partitions."""
    fields = _validate_group_fields(group_fields)
    groups_by_split: dict[str, set[str]] = {}
    counts_by_split: dict[str, dict[str, int]] = {}
    for split_name, records in splits.items():
        counter: Counter[str] = Counter()
        for record in records:
            counter[_group_key(record, fields)] += 1
        groups_by_split[split_name] = set(counter)
        counts_by_split[split_name] = dict(sorted(counter.items()))

    overlap: dict[str, list[str]] = {}
    split_names = list(groups_by_split)
    for index, left in enumerate(split_names):
        for right in split_names[index + 1 :]:
            common = sorted(groups_by_split[left] & groups_by_split[right])
            if common:
                overlap[f"{left}<>{right}"] = common
    return {
        "group_fields": list(fields),
        "groups_by_split": {
            name: sorted(groups) for name, groups in groups_by_split.items()
        },
        "counts_by_split": counts_by_split,
        "disjoint": not overlap,
        "overlap": overlap,
    }


def assert_no_group_leakage(
    splits: dict[str, list[dict]],
    group_fields: tuple[str, ...] = DEFAULT_GROUP_FIELDS,
) -> dict:
    report = leakage_report(splits, group_fields)
    if not report["disjoint"]:
        offending = "; ".join(
            f"{pair}: {keys}" for pair, keys in report["overlap"].items()
        )
        raise ValueError(f"fuga de grupo {report['group_fields']}: {offending}")
    return report


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
