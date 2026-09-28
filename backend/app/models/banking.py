from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Tenant

# Serving tables loaded by the data pipeline (gold layer). Read-only for the API.


class Customer(Base, Tenant):
    __tablename__ = "customers"
    customer_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    document_type: Mapped[str] = mapped_column(String(10))
    document_number: Mapped[str] = mapped_column(String(20))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(100))
    mobile_phone: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(50))
    segment: Mapped[str] = mapped_column(String(50))
    customer_status: Mapped[str] = mapped_column(String(20))
    detected_accent: Mapped[str | None] = mapped_column(String(50))
    registration_date: Mapped[datetime] = mapped_column(DateTime)
    preferred_language: Mapped[str] = mapped_column(String(2), default="es")
    # Set on the handful of customers the test chat offers; each one carries a scenario in its data.
    demo_scenario: Mapped[str | None] = mapped_column(String(40))


class Product(Base, Tenant):
    __tablename__ = "products"
    product_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(20), ForeignKey("customers.customer_id"), index=True)
    product_type: Mapped[str] = mapped_column(String(50))
    product_number: Mapped[str] = mapped_column(String(30))
    currency: Mapped[str] = mapped_column(String(3))
    current_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    product_status: Mapped[str] = mapped_column(String(20))
    opening_date: Mapped[date] = mapped_column(Date)


class Transaction(Base, Tenant):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_customer_date", "customer_id", "transaction_date"),)

    transaction_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(20), ForeignKey("customers.customer_id"))
    product_id: Mapped[str] = mapped_column(String(20))
    transaction_date: Mapped[datetime] = mapped_column(DateTime)
    process_date: Mapped[date] = mapped_column(Date)
    transaction_type: Mapped[str] = mapped_column(String(50))
    transaction_category: Mapped[str | None] = mapped_column(String(50))
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(3))
    amount_usd: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    channel: Mapped[str] = mapped_column(String(30))
    merchant_name: Mapped[str | None] = mapped_column(String(150))
    transaction_country: Mapped[str] = mapped_column(String(50))
    transaction_city: Mapped[str | None] = mapped_column(String(100))
    transaction_status: Mapped[str] = mapped_column(String(20))
    response_code: Mapped[str | None] = mapped_column(String(10))
    is_fraud: Mapped[bool] = mapped_column(Boolean)
    fraud_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))


class Complaint(Base, Tenant):
    __tablename__ = "complaints"
    complaint_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(20), ForeignKey("customers.customer_id"), index=True)
    creation_date: Mapped[datetime] = mapped_column(DateTime)
    case_type: Mapped[str] = mapped_column(String(30))
    category: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(Text)
