"""Bronze to silver. `full` rebuilds everything; `incremental` rereads files newer than the watermark minus a lookback."""

import argparse
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import duckdb

from chatquiry_pipeline.contracts import CONTRACTS, ORDER
from chatquiry_pipeline.silver import (
    TableReport,
    _partition_date,
    build_silver,
    lookback_start,
    report_json,
    select_files,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("CQ_DATA_DIR", ROOT / "data"))
LOOKBACK_DAYS = 3


def manifest(files: list[str]) -> list[dict]:
    """Lineage for every file read: size, delivery date and a content fingerprint of its head."""
    out = []
    for f in files:
        p = Path(f)
        with p.open("rb") as fh:
            head = hashlib.sha256(fh.read(1 << 16)).hexdigest()[:16]
        d = _partition_date(f)
        out.append(
            {
                "file": str(p.relative_to(DATA)) if p.is_relative_to(DATA) else f,
                "bytes": p.stat().st_size,
                "partition": str(d) if d else None,
                "head_sha256": head,
            }
        )
    return out


def run(mode: str, tables: list[str], data: Path = DATA) -> dict:
    bronze, silver, quarantine = data / "bronze", data / "silver", data / "quarantine"
    state_file = data / "state" / "pipeline_state.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    con = duckdb.connect()
    con.execute("set preserve_insertion_order = false")

    reports: list[TableReport] = []
    manifests: dict[str, list[dict]] = {}
    for table in [t for t in ORDER if t in tables]:
        contract = CONTRACTS[table]
        since = lookback_start(state.get(table, {}).get("watermark"), LOOKBACK_DAYS) if mode == "incremental" else None
        files = select_files(contract, bronze, since)
        manifests[table] = manifest(files)
        rep = build_silver(
            con,
            contract,
            files,
            silver,
            quarantine,
            run_id,
            state.get(table, {}).get("columns"),
        )
        reports.append(rep)
        dates = [d for f in files if (d := _partition_date(f))]
        if dates:
            state.setdefault(table, {})["watermark"] = str(max(dates))
        state.setdefault(table, {})["last_run"] = run_id
        if rep.columns_seen:
            state[table]["columns"] = rep.columns_seen
        print(
            f"{table:26s} in={rep.rows_in:>9,} valid={rep.rows_valid:>9,} quarantined={rep.rows_quarantined:>6,} "
            f"dups={rep.duplicates_removed:>5,} late={rep.late_rows:>5,} parts={rep.partitions_written:>5} new_cols={rep.new_columns}"
        )

    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2))
    result = {
        "run_id": run_id,
        "mode": mode,
        "lookback_days": LOOKBACK_DAYS,
        "tables": json.loads(report_json(reports)),
        "manifest": manifests,
    }
    reports_dir = data / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / f"silver_{run_id}.json").write_text(json.dumps(result, indent=2))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["full", "incremental"])
    parser.add_argument("--tables", nargs="*", default=ORDER)
    args = parser.parse_args()
    run(args.mode, args.tables)


if __name__ == "__main__":
    main()
