"""Entry point: `cq-pipeline all` runs silver, gold, load and the report in order."""

import argparse

from chatquiry_pipeline import gold, load, report, run
from chatquiry_pipeline.contracts import ORDER


def main() -> None:
    parser = argparse.ArgumentParser(prog="cq-pipeline")
    parser.add_argument("step", choices=["silver", "gold", "load", "report", "all"])
    parser.add_argument("--mode", choices=["full", "incremental"], default="incremental")
    args = parser.parse_args()
    if args.step in ("silver", "all"):
        run.run(args.mode, ORDER)
    if args.step in ("gold", "all"):
        gold.build()
    if args.step in ("load", "all"):
        load.load()
    if args.step in ("report", "all"):
        print(report.build())


if __name__ == "__main__":
    main()
