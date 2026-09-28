"""Synthetic fixture (not organizer data) that proves incremental loads stay correct."""

import json
from pathlib import Path

import duckdb
import pytest

from chatquiry_pipeline import run as runner

TX_HEADER = "transaction_id,transaction_date,process_date,product_id,customer_id,transaction_type,transaction_category,amount,currency,amount_usd,channel,merchant_name,transaction_country,transaction_city,transaction_status,response_code,is_fraud,fraud_score"


def tx(tid, date, amount="100.00", status="Approved", customer="C1", ttype="Purchase", currency="COP", extra=""):
    row = f"{tid},{date} 10:00:00,{date},P1,{customer},{ttype},,{amount},{currency},,App,Shop,Colombia,Bogotá,{status},00,False,10"
    return row + (f",{extra}" if extra else "")


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n")


def day(root: Path, d: str, rows: list[str], header: str = TX_HEADER) -> None:
    y, m, dd = d.split("-")
    write(root / "bronze" / "transactions" / f"year={y}" / f"month={m}" / f"day={dd}" / f"transactions_{y}{m}{dd}.csv", "\n".join([header, *rows]))


@pytest.fixture
def data(tmp_path: Path) -> Path:
    b = tmp_path / "bronze"
    write(
        b / "customers.csv",
        """customer_id,document_number,document_type,first_name,last_name,date_of_birth,city,state,country,segment,registration_date,customer_status,last_updated
C1,100,CC,Ana,Ruiz,1990-01-01,Bogotá,DC,Colombia,Basic,2024-01-01 00:00:00,Active,2025-01-01 00:00:00""",
    )
    write(
        b / "products.csv",
        """product_id,customer_id,product_type,product_number,currency,current_balance,opening_date,product_status,last_updated
P1,C1,Savings Account,0001,COP,10.00,2024-01-01,Active,2025-01-01 00:00:00""",
    )
    write(
        b / "daily_exchange_rates.csv",
        """date,source_currency,target_currency,exchange_rate
2026-06-01,COP,USD,0.00025
2026-06-02,COP,USD,0.00025
2026-06-03,COP,USD,0.00025""",
    )
    day(tmp_path, "2026-06-01", [tx("T1", "2026-06-01"), tx("T2", "2026-06-01")])
    day(tmp_path, "2026-06-02", [tx("T3", "2026-06-02", status="Pending")])
    return tmp_path


def silver_tx(data: Path) -> dict[str, tuple]:
    rows = duckdb.sql(
        f"select transaction_id, process_date::varchar, transaction_status, amount_usd from read_parquet('{data}/silver/transactions/**/*.parquet', hive_partitioning=true)"
    ).fetchall()
    return {r[0]: r[1:] for r in rows}


def test_incremental_load_handles_late_duplicate_new_column_and_orphan(data: Path):
    runner.run("full", runner.ORDER, data)
    assert set(silver_tx(data)) == {"T1", "T2", "T3"}

    # Day 3 delivery: a late row for day 1, a correction of T3, a new column, an orphan and a bad enum.
    header = TX_HEADER + ",device"
    day(
        data,
        "2026-06-03",
        [
            tx("T4", "2026-06-01", extra="ios"),
            tx("T3", "2026-06-02", status="Approved", extra="web"),
            tx("T5", "2026-06-03", customer="GHOST", extra="ios"),
            tx("T6", "2026-06-03", ttype="Teleport", extra="ios"),
            tx("T7", "2026-06-03", extra="android"),
        ],
        header,
    )
    result = runner.run("incremental", runner.ORDER, data)
    rep = next(t for t in result["tables"] if t["table"] == "transactions")
    silver = silver_tx(data)

    assert set(silver) == {"T1", "T2", "T3", "T4", "T7"}
    assert silver["T4"][0] == "2026-06-01", "late row lands in its own partition"
    assert silver["T3"][1] == "Approved", "the newer delivery of a key wins"
    assert float(silver["T7"][2]) == pytest.approx(0.03), "amount_usd derived from the daily rate"
    assert rep["late_rows"] == 2
    assert rep["new_columns"] == ["device"]
    assert rep["violations"] == {"orphan:customer_id": 1, "enum:transaction_type": 1}

    # Running the same delivery again changes nothing.
    runner.run("incremental", runner.ORDER, data)
    assert silver_tx(data) == silver
    state = json.loads((data / "state" / "pipeline_state.json").read_text())
    assert state["transactions"]["watermark"] == "2026-06-03"
