#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import platform
import statistics
import time
from pathlib import Path

import numpy as np
import psutil


def main() -> None:
    parser = argparse.ArgumentParser(description="Mide un ONNX en un proceso limpio")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--image-size", type=int, required=True)
    parser.add_argument("--warmup", type=int, default=50)
    parser.add_argument("--runs", type=int, default=1000)
    parser.add_argument("--threads", type=int, default=1)
    args = parser.parse_args()

    process = psutil.Process(os.getpid())
    rss_before_import = process.memory_info().rss
    import onnxruntime as ort

    rss_after_import = process.memory_info().rss
    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    session_started = time.perf_counter_ns()
    session = ort.InferenceSession(
        str(args.model),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )
    session_init_ms = (time.perf_counter_ns() - session_started) / 1_000_000
    rss_after_session = process.memory_info().rss
    sample = np.random.default_rng(1000).random(
        (1, 3, args.image_size, args.image_size),
        dtype=np.float32,
    )
    first_started = time.perf_counter_ns()
    session.run(None, {"image": sample})
    first_inference_ms = (time.perf_counter_ns() - first_started) / 1_000_000
    for _ in range(args.warmup):
        session.run(None, {"image": sample})
    latencies = []
    for _ in range(args.runs):
        started = time.perf_counter_ns()
        session.run(None, {"image": sample})
        latencies.append((time.perf_counter_ns() - started) / 1_000_000)
    ordered = sorted(latencies)

    def percentile(fraction: float) -> float:
        index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))
        return ordered[index]

    print(
        json.dumps(
            {
                "architecture": platform.machine(),
                "firstInferenceMs": first_inference_ms,
                "host": platform.platform(),
                "latencyMs": {
                    "mean": statistics.fmean(latencies),
                    "p50": percentile(0.50),
                    "p95": percentile(0.95),
                    "p99": percentile(0.99),
                },
                "modelBytes": args.model.stat().st_size,
                "onnxRuntimeVersion": ort.__version__,
                "provider": session.get_providers()[0],
                "rssBytes": {
                    "afterImport": rss_after_import,
                    "afterSession": rss_after_session,
                    "beforeImport": rss_before_import,
                    "importIncrement": rss_after_import - rss_before_import,
                    "sessionIncrement": rss_after_session - rss_after_import,
                },
                "runs": args.runs,
                "sessionInitMs": session_init_ms,
                "threads": args.threads,
                "warmup": args.warmup,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
