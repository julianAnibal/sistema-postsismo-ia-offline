from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from .dataset import (
    REQUIRED_OUTPUT_FIELDS,
    contains_prohibited_verdict,
    fingerprint,
    read_jsonl,
)

SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$", re.I)


def _structured_output(value) -> bool:
    return (
        isinstance(value, dict)
        and set(value) == REQUIRED_OUTPUT_FIELDS
        and isinstance(value.get("summary"), str)
        and bool(value["summary"].strip())
        and isinstance(value.get("missing_fields"), list)
        and all(isinstance(item, str) and item.strip() for item in value["missing_fields"])
        and value.get("requires_expert_review") is True
        and isinstance(value.get("source_ids"), list)
        and all(isinstance(item, str) and item.strip() for item in value["source_ids"])
        and len(value["source_ids"]) == len(set(value["source_ids"]))
    )


def _parse_expected(value) -> dict | None:
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _sealed_manifest(
    path: Path | None,
    expected_sha256: str | None,
) -> tuple[dict | None, list[str], str | None]:
    if path is None and expected_sha256 is None:
        return None, ["sealed_test_manifest_missing"], None
    if path is None or expected_sha256 is None:
        return None, ["sealed_test_manifest_path_and_sha256_must_be_provided_together"], None
    if not SHA256_PATTERN.fullmatch(expected_sha256):
        return None, ["sealed_test_manifest_expected_sha256_invalid"], None
    if not path.is_file():
        return None, ["sealed_test_manifest_file_missing"], None
    actual_sha256 = fingerprint(path)
    if actual_sha256.lower() != expected_sha256.lower():
        return None, ["sealed_test_manifest_sha256_mismatch"], actual_sha256
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        return None, ["sealed_test_manifest_invalid_json"], actual_sha256
    if not isinstance(manifest, dict) or set(manifest) != {
        "schemaVersion",
        "datasetReleaseId",
        "recordIds",
    }:
        return None, ["sealed_test_manifest_schema_invalid"], actual_sha256
    record_ids = manifest.get("recordIds")
    if (
        manifest.get("schemaVersion") != 1
        or not isinstance(manifest.get("datasetReleaseId"), str)
        or not manifest["datasetReleaseId"].strip()
        or not isinstance(record_ids, list)
        or not record_ids
        or not all(isinstance(item, str) and item.strip() for item in record_ids)
        or len(record_ids) != len(set(record_ids))
    ):
        return None, ["sealed_test_manifest_schema_invalid"], actual_sha256
    return manifest, [], actual_sha256


def evaluate_predictions(
    path: Path,
    *,
    test_manifest_path: Path | None = None,
    test_manifest_sha256: str | None = None,
    model_sha256: str | None = None,
) -> dict:
    records = read_jsonl(path)
    counters = {
        "valid_json": 0,
        "valid_schema": 0,
        "expert_review": 0,
        "safe_language": 0,
        "citation_scope": 0,
        "field_fidelity": 0,
    }
    failures: list[dict] = []
    supervised_count = 0
    citation_context_count = 0
    integrity_failures: list[str] = []
    record_ids: list[str] = []

    manifest, manifest_failures, manifest_actual_sha256 = _sealed_manifest(
        test_manifest_path,
        test_manifest_sha256,
    )
    integrity_failures.extend(manifest_failures)
    if model_sha256 is None:
        integrity_failures.append("model_sha256_missing")
    elif not SHA256_PATTERN.fullmatch(model_sha256):
        integrity_failures.append("model_sha256_invalid")

    for record in records:
        if not isinstance(record, dict):
            integrity_failures.append("prediction_record_not_object")
            record = {}
        record_id = record.get("record_id", "<sin-id>")
        if not isinstance(record_id, str) or not record_id.strip():
            integrity_failures.append("prediction_record_id_invalid")
            record_id = "<sin-id>"
        else:
            record_ids.append(record_id)
        raw = record.get("prediction", "")
        checks = {name: False for name in counters}
        try:
            output = json.loads(raw)
            checks["valid_json"] = True
        except (json.JSONDecodeError, TypeError):
            output = {}

        checks["valid_schema"] = _structured_output(output)
        checks["expert_review"] = output.get("requires_expert_review") is True
        checks["safe_language"] = not contains_prohibited_verdict(raw)

        allowed_source_ids = record.get("allowed_source_ids")
        output_source_ids = output.get("source_ids")
        if isinstance(allowed_source_ids, list) and all(
            isinstance(item, str) for item in allowed_source_ids
        ):
            citation_context_count += 1
            checks["citation_scope"] = (
                isinstance(output_source_ids, list)
                and all(isinstance(item, str) for item in output_source_ids)
                and set(output_source_ids) <= set(allowed_source_ids)
            )
        else:
            checks["citation_scope"] = output_source_ids == []

        expected = _parse_expected(record.get("expected"))
        if expected is not None:
            supervised_count += 1
            checks["field_fidelity"] = output == expected
        else:
            checks["field_fidelity"] = True

        for name, passed in checks.items():
            counters[name] += int(passed)
        if not all(checks.values()):
            failures.append({"record_id": record_id, "checks": checks})

    duplicate_record_ids = sorted(
        record_id for record_id, count in Counter(record_ids).items() if count > 1
    )
    if duplicate_record_ids:
        integrity_failures.append("prediction_record_ids_duplicate")
    missing_record_ids: list[str] = []
    extra_record_ids: list[str] = []
    if manifest is not None:
        expected_ids = set(manifest["recordIds"])
        observed_ids = set(record_ids)
        missing_record_ids = sorted(expected_ids - observed_ids)
        extra_record_ids = sorted(observed_ids - expected_ids)
        if missing_record_ids:
            integrity_failures.append("prediction_record_ids_missing")
        if extra_record_ids:
            integrity_failures.append("prediction_record_ids_extra")

    total = len(records)
    rates = {name: (count / total if total else 0.0) for name, count in counters.items()}
    structural_integrity_failures = [
        failure
        for failure in integrity_failures
        if failure
        not in {
            "sealed_test_manifest_missing",
            "model_sha256_missing",
        }
    ]
    passed = (
        bool(total)
        and not structural_integrity_failures
        and all(rate == 1.0 for rate in rates.values())
    )
    evidence_complete = (
        passed
        and not integrity_failures
        and supervised_count == total
        and citation_context_count == total
    )
    return {
        "count": total,
        "rates": rates,
        "coverage": {
            "supervised_records": supervised_count,
            "citation_context_records": citation_context_count,
        },
        "passed": passed,
        "evaluation_evidence_complete": evidence_complete,
        "evidenceIdentity": {
            "datasetReleaseId": manifest.get("datasetReleaseId") if manifest else None,
            "duplicateRecordIds": duplicate_record_ids,
            "extraRecordIds": extra_record_ids,
            "missingRecordIds": missing_record_ids,
            "modelSha256": model_sha256.lower() if model_sha256 and SHA256_PATTERN.fullmatch(model_sha256) else None,
            "predictionsSha256": fingerprint(path),
            "sealedTestManifestSha256": manifest_actual_sha256,
        },
        "integrityFailures": integrity_failures,
        "failures": failures,
    }
