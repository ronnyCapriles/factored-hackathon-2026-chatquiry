"""Loads the gold serving subset into the service database. Idempotent: rows are upserted by primary key."""

import json
import os
from pathlib import Path

import duckdb
import psycopg

from chatquiry_pipeline.gold import DATA

ORG, WORKSPACE = (
    os.environ.get("CQ_ORG_ID", "ORG-LATAM"),
    os.environ.get("CQ_WORKSPACE_ID", "WS-DEFAULT"),
)

# target table -> (primary key, {target column: source SQL expression})
TABLES: dict[str, tuple[str, dict[str, str]]] = {
    "customers": (
        "customer_id",
        {
            "customer_id": "customer_id",
            "document_type": "document_type",
            "document_number": "document_number",
            "first_name": "first_name",
            "last_name": "last_name",
            "email": "email",
            "mobile_phone": "mobile_phone",
            "city": "city",
            "country": "country",
            "segment": "segment",
            "customer_status": "customer_status",
            "detected_accent": "detected_accent",
            "registration_date": "registration_date",
            "preferred_language": "coalesce(d.language, 'es')",
            "demo_scenario": "d.scenario",
        },
    ),
    "products": (
        "product_id",
        {
            c: c
            for c in [
                "product_id",
                "customer_id",
                "product_type",
                "product_number",
                "currency",
                "current_balance",
                "credit_limit",
                "product_status",
                "opening_date",
            ]
        },
    ),
    "transactions": (
        "transaction_id",
        {
            c: c
            for c in [
                "transaction_id",
                "customer_id",
                "product_id",
                "transaction_date",
                "process_date",
                "transaction_type",
                "transaction_category",
                "amount",
                "currency",
                "amount_usd",
                "channel",
                "merchant_name",
                "transaction_country",
                "transaction_city",
                "transaction_status",
                "response_code",
                "is_fraud",
                "fraud_score",
            ]
        },
    ),
    "complaints": (
        "complaint_id",
        {
            c: c
            for c in [
                "complaint_id",
                "customer_id",
                "creation_date",
                "case_type",
                "category",
                "status",
                "description",
            ]
        },
    ),
}


def dsn() -> str:
    url = os.environ.get(
        "CQ_DATABASE_URL",
        "postgresql+asyncpg://chatquiry:chatquiry@127.0.0.1:5433/chatquiry",
    )
    return url.replace("postgresql+asyncpg://", "postgresql://")


def load(data: Path = DATA) -> dict[str, int]:
    serving = data / "gold" / "serving"
    meta = json.loads((data / "gold" / "meta.json").read_text())
    duck = duckdb.connect()
    duck.execute("create table demo (customer_id varchar, language varchar, scenario varchar)")
    for d in meta["demo_customers"]:
        duck.execute(
            "insert into demo values (?, ?, ?)",
            [d["customer_id"], d["language"], d["scenario"]],
        )

    loaded = {}
    with psycopg.connect(dsn()) as pg, pg.cursor() as cur:
        for table, (pk, cols) in TABLES.items():
            source = f"read_parquet('{serving / table}.parquet') s"
            if table == "customers":
                source += " left join demo d using (customer_id)"
            select = ", ".join(f"{expr} as {col}" for col, expr in cols.items())
            rows = duck.execute(f"select {select} from {source}").fetchall()
            names = [*cols, "org_id", "workspace_id"]
            cur.execute(f"create temp table stage (like {table} including defaults) on commit drop")
            with cur.copy(f"copy stage ({', '.join(names)}) from stdin") as copy:
                for row in rows:
                    copy.write_row((*row, ORG, WORKSPACE))
            updates = ", ".join(f"{c} = excluded.{c}" for c in names if c != pk)
            cur.execute(f"insert into {table} ({', '.join(names)}) select {', '.join(names)} from stage on conflict ({pk}) do update set {updates}")
            cur.execute("drop table stage")
            loaded[table] = len(rows)
            print(f"{table:14s} upserted {len(rows):>7,}")
        # Demo flags follow the latest selection only.
        demo_ids = [d["customer_id"] for d in meta["demo_customers"]]
        cur.execute(
            "update customers set demo_scenario = null where workspace_id = %s and not (customer_id = any(%s))",
            (WORKSPACE, demo_ids),
        )
        pg.commit()
    return loaded


if __name__ == "__main__":
    load()
