#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml" / "src"))

from mil_ojos_ml.model_pack import build_manifest  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Empaqueta un modelo movil ya convertido")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--notice", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    if args.model.suffix != ".litertlm":
        raise SystemExit("El modelo debe estar convertido al formato .litertlm")
    args.output.mkdir(parents=True, exist_ok=True)
    model_target = args.output / args.model.name
    shutil.copy2(args.model, model_target)
    shutil.copy2(args.notice, args.output / "NOTICE.txt")
    build_manifest(model_target, args.output / "model-pack.json", model_id=args.id, version=args.version, runtime="litert-lm")
    print(f"Paquete creado: {args.output}")


if __name__ == "__main__":
    main()
