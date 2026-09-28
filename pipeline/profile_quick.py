"""First-pass profile of the bronze layer (exploration only; the real pipeline comes next)."""
import duckdb

con = duckdb.connect()
B = "../data/bronze"
tables = {
    "customers": f"{B}/customers.csv",
    "products": f"{B}/products.csv",
    "transactions": f"{B}/transactions/**/*.csv",
    "call_center_interactions": f"{B}/call_center_interactions/**/*.csv",
    "call_transcripts": f"{B}/call_transcripts/**/*.csv",
    "complaints": f"{B}/complaints/**/*.csv",
}
pk = {"customers": "customer_id", "products": "product_id", "transactions": "transaction_id",
      "call_center_interactions": "interaction_id", "call_transcripts": "transcript_id", "complaints": "complaint_id"}
for t, path in tables.items():
    con.execute(f"create view {t} as select * from read_csv('{path}', union_by_name=true, all_varchar=true, header=true)")
    n, d = con.execute(f"select count(*), count(*) - count(distinct {pk[t]}) from {t}").fetchone()
    print(f"{t:26s} rows={n:>9,}  dup_pk={d:>7,} ({d/n:.2%})")

print("\n-- contact_reason (top 15) / reason_category")
for r in con.execute("select reason_category, contact_reason, count(*) n, round(avg(case when was_resolved='True' then 1 else 0 end),3) fcr, round(avg(case when was_escalated='True' then 1 else 0 end),3) esc from call_center_interactions group by 1,2 order by n desc limit 15").fetchall():
    print(r)
print("\n-- channel mix"); print(con.execute("select channel, count(*) from call_center_interactions group by 1 order by 2 desc").fetchall())
print("\n-- transcripts with unfilled template placeholders {..}")
print(con.execute("select count(*) filter (where full_text like '%{%}%'), count(*) from call_transcripts").fetchone())
print("\n-- detected_language"); print(con.execute("select detected_language, count(*) from call_transcripts group by 1").fetchall())
print("\n-- transaction_status"); print(con.execute("select transaction_status, count(*) from transactions group by 1 order by 2 desc").fetchall())
print("\n-- late arrivals: transaction_date::date > process_date")
print(con.execute("select count(*) filter (where try_cast(transaction_date as timestamp)::date > try_cast(process_date as date)), count(*) from transactions").fetchone())
print("\n-- complaint categories (top 10)")
for r in con.execute("select category, count(*), round(avg(case when sla_breached='True' then 1 else 0 end),3) from complaints group by 1 order by 2 desc limit 10").fetchall(): print(r)
