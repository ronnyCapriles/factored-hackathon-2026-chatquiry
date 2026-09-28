"""Silver to gold: analytics marts, baseline KPIs, the ML intent dataset and the serving subset."""

import json
import os
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("CQ_DATA_DIR", ROOT / "data"))
SAMPLE_SIZE = 2000
SEED = "chatquiry-42"
# Assumption for the cost baseline, stated in every report that uses it.
AGENT_COST_PER_MINUTE_USD = 0.50

MARTS = {
    "mart_contact_reasons": """
        select i.reason_category, i.channel,
               count(*) as contacts,
               avg(case when i.was_resolved then 1.0 else 0 end) as fcr,
               avg(case when i.was_escalated then 1.0 else 0 end) as escalation_rate,
               avg(i.duration_seconds) as avg_duration_s,
               avg(i.wait_time_seconds) as avg_wait_s,
               avg(s.main_score) filter (where s.survey_type = 'CSAT') as csat
        from ints i left join surveys s using (interaction_id)
        group by i.reason_category, i.channel order by contacts desc""",
    "mart_monthly_demand": """
        select date_trunc('month', interaction_date)::date as month, reason_category, channel, count(*) as contacts
        from ints group by 1, 2, 3 order by month, contacts desc""",
    "mart_complaints": """
        select category, subcategory, count(*) as complaints,
               avg(case when sla_breached then 1.0 else 0 end) as sla_breach_rate,
               avg(resolution_days) as avg_resolution_days
        from complaints group by category, subcategory order by complaints desc""",
    "mart_transaction_status": """
        select transaction_type, transaction_status, count(*) as transactions,
               count(*) / sum(count(*)) over (partition by transaction_type) as share_of_type
        from tx group by transaction_type, transaction_status order by transaction_type, transactions desc""",
}


def _views(con: duckdb.DuckDBPyConnection, silver: Path) -> None:
    for view, table in [
        ("tx", "transactions"),
        ("ints", "call_center_interactions"),
        ("transcripts", "call_transcripts"),
        ("complaints", "complaints"),
        ("surveys", "satisfaction_surveys"),
        ("customers", "customers"),
        ("products", "products"),
    ]:
        con.execute(f"create or replace view {view} as select * from read_parquet('{silver / table}/**/*.parquet', hive_partitioning=true, union_by_name=true)")


def build(data: Path = DATA) -> dict:
    silver, gold = data / "silver", data / "gold"
    (gold / "serving").mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    _views(con, silver)

    for name, sql in MARTS.items():
        con.execute(f"copy ({sql}) to '{gold / name}.parquet' (format parquet)")

    b = con.execute(
        """select count(*),
                  avg(case when reason_category = 'Transaccional' then 1.0 else 0 end),
                  avg(case when was_resolved then 1.0 else 0 end),
                  avg(case when was_resolved then 1.0 else 0 end) filter (where reason_category = 'Transaccional'),
                  avg(case when was_escalated then 1.0 else 0 end),
                  avg(duration_seconds), avg(wait_time_seconds),
                  avg(case when channel = 'Phone' then 1.0 else 0 end)
           from ints"""
    ).fetchone()
    csat = con.execute("select avg(main_score) from surveys where survey_type = 'CSAT'").fetchone()[0]
    baseline = {
        "contacts": b[0],
        "transactional_share": round(b[1], 4),
        "fcr": round(b[2], 4),
        "fcr_transactional": round(b[3], 4),
        "escalation_rate": round(b[4], 4),
        "avg_handle_time_s": round(b[5], 1),
        "avg_wait_s": round(b[6], 1),
        "phone_share": round(b[7], 4),
        "csat": round(csat, 3),
        "assumed_agent_cost_per_minute_usd": AGENT_COST_PER_MINUTE_USD,
        "cost_per_contact_usd": round(b[5] / 60 * AGENT_COST_PER_MINUTE_USD, 3),
    }

    # Labels come from the interaction; detected_intents is constant and carries no signal.
    con.execute(
        f"""copy (select t.transcript_id, t.interaction_id, t.customer_id, t.process_date, t.customer_text, t.full_text,
                        i.reason_category, i.contact_reason, i.channel, i.was_escalated
                 from transcripts t join ints i using (interaction_id)
                 where t.customer_text is not null) to '{gold / "ml_intent_dataset.parquet"}' (format parquet)"""
    )

    as_of = con.execute("select max(transaction_date) from tx").fetchone()[0]
    demo = _pick_demo(con, as_of)
    demo_ids = ",".join(f"'{d['customer_id']}'" for d in demo)
    con.execute(
        f"""create temp table sample as
        with active as (select * from customers where customer_status = 'Active'),
        ranked as (
          select *, row_number() over (partition by country, segment order by hash(customer_id || '{SEED}')) as rn,
                 count(*) over (partition by country, segment) as n_group, count(*) over () as n_total
          from active)
        select customer_id from ranked where rn <= ceil({SAMPLE_SIZE} * n_group / n_total)
        union select unnest([{demo_ids}])"""
    )
    serving = {
        "customers": "select c.* from customers c join sample using (customer_id)",
        "products": "select p.* from products p join sample using (customer_id)",
        "transactions": "select t.* from tx t join sample using (customer_id)",
        "complaints": "select x.* from complaints x join sample using (customer_id)",
    }
    counts = {}
    for name, sql in serving.items():
        con.execute(f"copy ({sql}) to '{gold / 'serving' / name}.parquet' (format parquet)")
        counts[name] = con.execute(f"select count(*) from ({sql})").fetchone()[0]

    meta = {
        "as_of": as_of.isoformat(),
        "sample_size": SAMPLE_SIZE,
        "seed": SEED,
        "counts": counts,
        "demo_customers": demo,
        "baseline": baseline,
    }
    (gold / "meta.json").write_text(json.dumps(meta, indent=2, default=str))
    print(
        json.dumps(
            {
                "as_of": meta["as_of"],
                "counts": counts,
                "demo": [(d["customer_id"], d["scenario"]) for d in demo],
            },
            indent=2,
        )
    )
    return meta


def _pick_demo(con: duckdb.DuckDBPyConnection, as_of) -> list[dict]:
    """Real customers whose data already contain each demo scenario."""
    picks = [
        (
            "pending_transfer_in_time",
            "México",
            "es",
            """exists (select 1 from tx t where t.customer_id = c.customer_id and t.transaction_type = 'Transfer'
                      and t.transaction_status = 'Pending' and t.transaction_date > as_of - interval 20 hour)
               and (select count(*) from tx t where t.customer_id = c.customer_id and t.transaction_type = 'Transfer'
                      and t.transaction_date > as_of - interval 7 day) >= 2""",
        ),
        (
            "pending_transfer_overdue",
            "Colombia",
            "es",
            """exists (select 1 from tx t where t.customer_id = c.customer_id and t.transaction_type = 'Transfer'
                      and t.transaction_status = 'Pending' and t.transaction_date between as_of - interval 5 day and as_of - interval 30 hour)""",
        ),
        (
            "unrecognized_purchase_fraud_signal",
            "Argentina",
            "pt",
            """exists (select 1 from tx t where t.customer_id = c.customer_id and t.transaction_type = 'Purchase'
                      and t.transaction_status = 'Approved' and (t.is_fraud or t.fraud_score > 30)
                      and t.transaction_date > as_of - interval 30 day)""",
        ),
    ]
    out = []
    for scenario, country, language, cond in picks:
        row = con.execute(
            f"""with p as (select timestamp '{as_of}' as as_of)
            select c.customer_id, c.first_name, c.last_name from customers c, p
            where c.customer_status = 'Active' and c.country = '{country}' and {cond}
            order by hash(c.customer_id || '{SEED}') limit 1"""
        ).fetchone()
        if row:
            out.append(
                {
                    "customer_id": row[0],
                    "first_name": row[1],
                    "full_name": f"{row[1]} {row[2]}",
                    "country": country,
                    "language": language,
                    "scenario": scenario,
                }
            )
    return out


if __name__ == "__main__":
    build()
