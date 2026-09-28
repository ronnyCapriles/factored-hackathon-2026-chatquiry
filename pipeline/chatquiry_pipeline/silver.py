import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import duckdb

from chatquiry_pipeline.contracts import Contract

PARTITION_RE = re.compile(r"year=(\d{4})/month=(\d{2})/day=(\d{2})")


@dataclass
class TableReport:
    table: str
    files_read: int = 0
    rows_in: int = 0
    rows_valid: int = 0
    rows_quarantined: int = 0
    duplicates_removed: int = 0
    late_rows: int = 0
    violations: dict[str, int] = field(default_factory=dict)
    null_rates: dict[str, float] = field(default_factory=dict)
    columns_seen: list[str] = field(default_factory=list)
    new_columns: list[str] = field(default_factory=list)
    unused_columns: list[str] = field(default_factory=list)
    missing_optional: list[str] = field(default_factory=list)
    partitions_written: int = 0
    derived: dict[str, int] = field(default_factory=dict)


def _partition_date(path: str) -> date | None:
    m = PARTITION_RE.search(path)
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None


def select_files(contract: Contract, bronze: Path, since: date | None) -> list[str]:
    files = sorted(str(p) for p in bronze.glob(contract.path))
    if since is None:
        return files
    # Unpartitioned files (dimensions) are always reread; they are small snapshots.
    return [f for f in files if (d := _partition_date(f)) is None or d >= since]


def _q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def build_silver(
    con: duckdb.DuckDBPyConnection,
    contract: Contract,
    files: list[str],
    silver: Path,
    quarantine: Path,
    run_id: str,
    previous_columns: list[str] | None = None,
) -> TableReport:
    rep = TableReport(contract.table, files_read=len(files))
    if not files:
        return rep
    file_list = "[" + ",".join("'" + f.replace("'", "''") + "'" for f in files) + "]"
    con.execute(f"create or replace temp view raw as select * from read_csv({file_list}, union_by_name=true, all_varchar=true, header=true, filename=true)")

    present = {r[0] for r in con.execute("describe raw").fetchall()} - {"filename"}
    expected = {c.name for c in contract.columns}
    missing_required = [c.name for c in contract.columns if c.required and c.name not in present]
    if missing_required:
        raise ValueError(f"{contract.table}: required columns missing from source: {missing_required}")
    rep.columns_seen = sorted(present)
    # Additive schema changes are allowed and reported; they reach silver once the contract adds them.
    rep.new_columns = sorted(present - set(previous_columns)) if previous_columns else []
    rep.unused_columns = sorted(present - expected)
    rep.missing_optional = sorted(expected - present)

    typed, checks = [], []
    for c in contract.columns:
        raw = f"nullif(trim(raw.{_q(c.name)}), '')" if c.name in present else "null"
        val = f"try_cast({raw} as {c.type})" if c.type != "VARCHAR" else raw
        typed.append(f"{val} as {_q(c.name)}")
        if c.required:
            checks.append(f"case when {raw} is null then 'missing:{c.name}' end")
        if c.type != "VARCHAR":
            checks.append(f"case when {raw} is not null and {val} is null then 'type:{c.name}' end")
        if c.enum:
            allowed = ",".join("'" + e.replace("'", "''") + "'" for e in c.enum)
            checks.append(f"case when {raw} is not null and {raw} not in ({allowed}) then 'enum:{c.name}' end")
        if c.min is not None:
            checks.append(f"case when {val} < {c.min} then 'range:{c.name}' end")
        if c.max is not None:
            checks.append(f"case when {val} > {c.max} then 'range:{c.name}' end")

    fk_joins, fk_checks = [], []
    for i, (col, ref) in enumerate(contract.foreign_keys.items()):
        ref_table, ref_col = ref.split(".")
        ref_path = silver / ref_table
        if not ref_path.exists():
            continue
        fk_joins.append(
            f"left join (select distinct {_q(ref_col)} as k from read_parquet('{ref_path}/**/*.parquet', union_by_name=true)) fk{i} on fk{i}.k = t.{_q(col)}"
        )
        fk_checks.append(f"case when t.{_q(col)} is not null and fk{i}.k is null then 'orphan:{col}' end")

    con.execute(
        f"""create or replace temp table typed as
        select {", ".join(typed)},
               raw.filename as _source_file,
               list_filter([{", ".join(checks) or "null"}], x -> x is not null) as _violations
        from raw"""
    )
    if fk_checks:
        con.execute(
            f"""create or replace temp table typed as
            select t.* replace (list_concat(t._violations, list_filter([{", ".join(fk_checks)}], x -> x is not null)) as _violations)
            from typed t {" ".join(fk_joins)}"""
        )

    rep.rows_in = con.execute("select count(*) from typed").fetchone()[0]
    for reason, n in con.execute("select v, count(*) from (select unnest(_violations) v from typed) group by 1").fetchall():
        rep.violations[reason] = n

    quarantine.mkdir(parents=True, exist_ok=True)
    rep.rows_quarantined = con.execute("select count(*) from typed where len(_violations) > 0").fetchone()[0]
    if rep.rows_quarantined:
        con.execute(
            f"copy (select *, '{run_id}' as _run_id from typed where len(_violations) > 0) to '{quarantine / (contract.table + '_' + run_id + '.parquet')}' (format parquet)"
        )

    order = ", ".join(f"{_q(c)} desc nulls last" for c in contract.order_by) or "1"
    con.execute(
        f"""create or replace temp table clean as
        select * exclude (_violations, _rn), '{run_id}' as _run_id, now() as _ingested_at
        from (select *, row_number() over (partition by {contract.key} order by {order}, _source_file desc) as _rn
              from typed where len(_violations) = 0)
        where _rn = 1"""
    )
    valid_before_dedup = rep.rows_in - rep.rows_quarantined
    rep.rows_valid = con.execute("select count(*) from clean").fetchone()[0]
    rep.duplicates_removed = valid_before_dedup - rep.rows_valid

    if contract.partition:
        # A row is late when it arrives in a file delivered after its own process date.
        file_date = (
            "make_date(regexp_extract(_source_file, 'year=(\\d{4})', 1)::int, "
            "regexp_extract(_source_file, 'month=(\\d{2})', 1)::int, regexp_extract(_source_file, 'day=(\\d{2})', 1)::int)"
        )
        rep.late_rows = con.execute(
            f"select count(*) from clean where regexp_matches(_source_file, 'year=\\d{{4}}') and {file_date} > {_q(contract.partition)}"
        ).fetchone()[0]

    if contract.table == "transactions":
        _derive_usd(con, silver, rep)

    for c in contract.columns:
        rate = con.execute(f"select avg(case when {_q(c.name)} is null then 1.0 else 0 end) from clean").fetchone()[0]
        rep.null_rates[c.name] = round(rate or 0.0, 4)

    rep.partitions_written = _write(con, contract, silver)
    return rep


def _derive_usd(con: duckdb.DuckDBPyConnection, silver: Path, rep: TableReport) -> None:
    """USD rows arrive without amount_usd and some local rows lack it; fill both from the daily rate."""
    fx = silver / "daily_exchange_rates"
    if not fx.exists():
        return
    rep.derived["amount_usd_from_currency"] = con.execute("select count(*) from clean where amount_usd is null and currency = 'USD'").fetchone()[0]
    rep.derived["amount_usd_from_fx"] = con.execute(
        f"""select count(*) from clean c join read_parquet('{fx}/**/*.parquet') r
            on r.date = c.transaction_date::date and r.source_currency = c.currency and r.target_currency = 'USD' where c.amount_usd is null"""
    ).fetchone()[0]
    con.execute(
        f"""create or replace temp table clean as
        select c.* replace (coalesce(c.amount_usd, case when c.currency = 'USD' then c.amount else round(c.amount * r.exchange_rate, 2) end) as amount_usd)
        from clean c left join read_parquet('{fx}/**/*.parquet') r
          on r.date = c.transaction_date::date and r.source_currency = c.currency and r.target_currency = 'USD'"""
    )


def _write(con: duckdb.DuckDBPyConnection, contract: Contract, silver: Path) -> int:
    out = silver / contract.table
    if not contract.partition:
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir(parents=True)
        con.execute(f"copy clean to '{out / 'data.parquet'}' (format parquet)")
        return 1

    # Rewrite only the partitions present in this batch, merged with what silver already holds.
    part = contract.partition
    dates = [r[0] for r in con.execute(f"select distinct {_q(part)} from clean order by 1").fetchall()]
    existing = out.exists() and any(out.glob("**/*.parquet"))
    if existing:
        con.execute(
            f"""create or replace temp table merged as
            select * exclude (_rn) from (
              select *, row_number() over (partition by {contract.key} order by _ingested_at desc) as _rn
              from (select * from clean
                    union all by name
                    select * from read_parquet('{out}/**/*.parquet', hive_partitioning=true, union_by_name=true)
                    where {_q(part)} in (select distinct {_q(part)} from clean)))
            where _rn = 1"""
        )
    else:
        con.execute("create or replace temp table merged as select * from clean")
    for d in dates:
        shutil.rmtree(out / f"{part}={d}", ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    con.execute(f"copy merged to '{out}' (format parquet, partition_by ({_q(part)}), overwrite_or_ignore true, filename_pattern 'part_{{uuid}}')")
    return len(dates)


def report_json(reports: list[TableReport]) -> str:
    return json.dumps([r.__dict__ for r in reports], indent=2, default=str)


def lookback_start(watermark: str | None, days: int) -> date | None:
    if not watermark:
        return None
    return date.fromisoformat(watermark) - timedelta(days=days)
