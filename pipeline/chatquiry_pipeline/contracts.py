"""Data contracts for the bronze CSV files. Silver only keeps rows that satisfy them."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Col:
    name: str
    type: str = "VARCHAR"  # DuckDB type the value must cast to
    required: bool = False
    enum: tuple[str, ...] | None = None
    min: float | None = None
    max: float | None = None


@dataclass(frozen=True)
class Contract:
    table: str
    path: str  # glob relative to the bronze root
    key: str  # column name or SQL expression that identifies a row
    columns: tuple[Col, ...]
    # Newest version of a duplicated key wins, ordered by these columns.
    order_by: tuple[str, ...] = ()
    partition: str | None = None  # column holding the delivery date, for incremental runs
    foreign_keys: dict[str, str] = field(default_factory=dict)  # column -> "table.column"


COUNTRIES = ("México", "Colombia", "Argentina")
CURRENCIES = ("MXN", "COP", "ARS", "USD")

CONTRACTS: dict[str, Contract] = {
    c.table: c
    for c in [
        Contract(
            "customers",
            "customers.csv",
            "customer_id",
            (
                Col("customer_id", required=True),
                Col("document_number", required=True),
                Col("document_type", required=True),
                Col("first_name", required=True),
                Col("last_name", required=True),
                Col("date_of_birth", "DATE", required=True),
                Col("email"),
                Col("mobile_phone"),
                Col("city", required=True),
                Col("state", required=True),
                Col("country", required=True, enum=COUNTRIES),
                Col("detected_accent"),
                Col(
                    "segment",
                    required=True,
                    enum=("Premium", "Plus", "Basic", "Student"),
                ),
                Col("credit_score", "INTEGER", min=300, max=850),
                Col("registration_date", "TIMESTAMP", required=True),
                Col(
                    "customer_status",
                    required=True,
                    enum=("Active", "Inactive", "Suspended", "Closed"),
                ),
                Col("last_updated", "TIMESTAMP", required=True),
            ),
            order_by=("last_updated",),
        ),
        Contract(
            "products",
            "products.csv",
            "product_id",
            (
                Col("product_id", required=True),
                Col("customer_id", required=True),
                Col("product_type", required=True),
                Col("product_number", required=True),
                Col("currency", required=True, enum=CURRENCIES),
                Col("current_balance", "DECIMAL(15,2)", required=True),
                Col("credit_limit", "DECIMAL(15,2)"),
                Col("opening_date", "DATE", required=True),
                Col(
                    "product_status",
                    required=True,
                    enum=("Active", "Blocked", "Closed", "Suspended"),
                ),
                Col("last_updated", "TIMESTAMP", required=True),
            ),
            order_by=("last_updated",),
            foreign_keys={"customer_id": "customers.customer_id"},
        ),
        Contract(
            "transactions",
            "transactions/**/*.csv",
            "transaction_id",
            (
                Col("transaction_id", required=True),
                Col("transaction_date", "TIMESTAMP", required=True),
                Col("process_date", "DATE", required=True),
                Col("product_id", required=True),
                Col("customer_id", required=True),
                Col(
                    "transaction_type",
                    required=True,
                    enum=(
                        "Deposit",
                        "Withdrawal",
                        "Transfer",
                        "Payment",
                        "Purchase",
                        "Adjustment",
                    ),
                ),
                Col("transaction_category"),
                Col("amount", "DECIMAL(15,2)", required=True),
                Col("currency", required=True, enum=CURRENCIES),
                Col("amount_usd", "DECIMAL(15,2)"),
                Col("channel", required=True),
                Col("merchant_name"),
                Col("transaction_country", required=True),
                Col("transaction_city"),
                Col(
                    "transaction_status",
                    required=True,
                    enum=("Approved", "Declined", "Pending", "Reversed"),
                ),
                Col("response_code"),
                Col("is_fraud", "BOOLEAN", required=True),
                Col("fraud_score", "DOUBLE", min=0, max=100),
            ),
            order_by=("process_date",),
            partition="process_date",
            foreign_keys={
                "customer_id": "customers.customer_id",
                "product_id": "products.product_id",
            },
        ),
        Contract(
            "call_center_interactions",
            "call_center_interactions/**/*.csv",
            "interaction_id",
            (
                Col("interaction_id", required=True),
                Col("interaction_date", "TIMESTAMP", required=True),
                Col("process_date", "DATE", required=True),
                Col("customer_id", required=True),
                Col("agent_id"),
                Col("interaction_type", required=True),
                Col("channel", required=True),
                Col("contact_reason", required=True),
                Col("reason_category", required=True),
                Col("duration_seconds", "INTEGER", min=0),
                Col("wait_time_seconds", "INTEGER", min=0),
                Col("was_resolved", "BOOLEAN"),
                Col("requires_followup", "BOOLEAN", required=True),
                Col("detected_sentiment"),
                Col("sentiment_score", "DOUBLE", min=-1, max=1),
                Col("was_escalated", "BOOLEAN", required=True),
                Col("has_transcript", "BOOLEAN", required=True),
            ),
            order_by=("process_date",),
            partition="process_date",
            foreign_keys={"customer_id": "customers.customer_id"},
        ),
        Contract(
            "call_transcripts",
            "call_transcripts/**/*.csv",
            "transcript_id",
            (
                Col("transcript_id", required=True),
                Col("interaction_id", required=True),
                Col("process_date", "DATE", required=True),
                Col("customer_id", required=True),
                Col("full_text", required=True),
                Col("customer_text"),
                Col("detected_language", required=True),
                Col("detected_intents"),
                Col("main_topics"),
                # Documented as NOT NULL but empty in about 14% of rows; not needed downstream, so optional.
                Col("duration_seconds", "INTEGER", min=0),
            ),
            order_by=("process_date",),
            partition="process_date",
            foreign_keys={"interaction_id": "call_center_interactions.interaction_id"},
        ),
        Contract(
            "complaints",
            "complaints/**/*.csv",
            "complaint_id",
            (
                Col("complaint_id", required=True),
                Col("creation_date", "TIMESTAMP", required=True),
                Col("process_date", "DATE", required=True),
                Col("customer_id", required=True),
                Col("case_type", required=True),
                Col("category", required=True),
                Col("subcategory"),
                Col("reception_channel", required=True),
                Col("affected_product_id"),
                Col("description", required=True),
                Col("claimed_amount", "DECIMAL(15,2)"),
                Col("currency"),
                Col(
                    "priority",
                    required=True,
                    enum=("Low", "Medium", "High", "Critical"),
                ),
                Col("status", required=True),
                Col("sla_breached", "BOOLEAN", required=True),
                Col("resolution_days", "INTEGER", min=0),
            ),
            order_by=("process_date",),
            partition="process_date",
            foreign_keys={"customer_id": "customers.customer_id"},
        ),
        Contract(
            "satisfaction_surveys",
            "satisfaction_surveys/**/*.csv",
            "survey_id",
            (
                Col("survey_id", required=True),
                Col("survey_date", "TIMESTAMP", required=True),
                Col("process_date", "DATE", required=True),
                Col("interaction_id"),
                Col("customer_id", required=True),
                Col("survey_type", required=True, enum=("CSAT", "NPS", "CES")),
                Col("main_score", "INTEGER", required=True, min=0, max=10),
            ),
            order_by=("process_date",),
            partition="process_date",
        ),
        Contract(
            "daily_exchange_rates",
            "daily_exchange_rates.csv",
            "date || '|' || source_currency || '|' || target_currency",
            (
                Col("date", "DATE", required=True),
                Col("source_currency", required=True, enum=CURRENCIES),
                Col("target_currency", required=True, enum=CURRENCIES),
                Col("exchange_rate", "DOUBLE", required=True, min=0),
            ),
        ),
    ]
}

# Tables loaded in this order so foreign keys resolve against already cleaned data.
ORDER = [
    "daily_exchange_rates",
    "customers",
    "products",
    "transactions",
    "call_center_interactions",
    "call_transcripts",
    "complaints",
    "satisfaction_surveys",
]
