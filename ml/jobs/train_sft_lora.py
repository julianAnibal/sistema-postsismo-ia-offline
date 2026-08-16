# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "accelerate>=1.6",
#   "datasets>=3.5",
#   "peft>=0.15",
#   "trackio>=0.2",
#   "transformers>=4.51",
#   "trl>=0.16",
# ]
# ///
"""Supervised LoRA training job for 1000 ojos.

This script accepts either a private Hub dataset or local JSONL. A real run must
push its adapter to a private Hub repository because cloud job disks are
ephemeral.
"""
from __future__ import annotations

import argparse
import os

from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-id", required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--dataset-id")
    source.add_argument("--dataset-path")
    parser.add_argument("--hub-model-id", required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--seed", type=int, default=1000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN es obligatorio para guardar el adaptador")
    if args.dataset_id:
        dataset = load_dataset(args.dataset_id, token=token)
    else:
        dataset = load_dataset(
            "json",
            data_files={
                "train": f"{args.dataset_path}/train.jsonl",
                "validation": f"{args.dataset_path}/validation.jsonl",
            },
        )
    trainer = SFTTrainer(
        model=args.model_id,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        peft_config=LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
        ),
        args=SFTConfig(
            output_dir="/tmp/1000-ojos-language",
            num_train_epochs=args.epochs,
            learning_rate=args.learning_rate,
            max_length=args.max_length,
            seed=args.seed,
            bf16=True,
            gradient_checkpointing=True,
            eval_strategy="steps",
            eval_steps=50,
            save_steps=50,
            logging_steps=5,
            report_to="trackio",
            project="1000-ojos",
            run_name="gemma-language-sft",
            push_to_hub=True,
            hub_model_id=args.hub_model_id,
            hub_private_repo=True,
            hub_token=token,
        ),
    )
    trainer.train()
    trainer.push_to_hub()


if __name__ == "__main__":
    main()
