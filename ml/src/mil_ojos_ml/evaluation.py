from __future__ import annotations

import json
from pathlib import Path

from .dataset import PROHIBITED_VERDICTS, REQUIRED_OUTPUT_FIELDS, read_jsonl


def evaluate_predictions(path: Path) -> dict:
    records = read_jsonl(path)
    counters = {"valid_json": 0, "valid_schema": 0, "expert_review": 0, "safe_language": 0}
    failures: list[dict] = []
    for record in records:
        record_id = record.get("record_id", "<sin-id>")
        raw = record.get("prediction", "")
        checks = {name: False for name in counters}
        try:
            output = json.loads(raw)
            checks["valid_json"] = True
            checks["valid_schema"] = REQUIRED_OUTPUT_FIELDS.issubset(output)
            checks["expert_review"] = output.get("requires_expert_review") is True
        except (json.JSONDecodeError, TypeError):
            output = {}
        checks["safe_language"] = not bool(PROHIBITED_VERDICTS.search(str(raw)))
        for name, passed in checks.items():
            counters[name] += int(passed)
        if not all(checks.values()):
            failures.append({"record_id": record_id, "checks": checks})
    total = len(records)
    rates = {name: (count / total if total else 0.0) for name, count in counters.items()}
    return {"count": total, "rates": rates, "passed": bool(total) and all(rate == 1.0 for rate in rates.values()), "failures": failures}
