from datetime import datetime

from sqlalchemy import delete

from app.core.db import SessionLocal
from app.models import Customer

TENANT = {"org_id": "ORG-LATAM", "workspace_id": "WS-DEFAULT"}


def _customer(customer_id: str, scenario: str | None, language: str = "es") -> Customer:
    return Customer(
        customer_id=customer_id,
        document_type="CC",
        document_number="123456",
        first_name="Marta Lucía",
        last_name="Prueba",
        city="Bogotá",
        country="Colombia",
        segment="Basic",
        customer_status="Active",
        registration_date=datetime(2024, 1, 1),
        preferred_language=language,
        demo_scenario=scenario,
        **TENANT,
    )


async def test_only_demo_customers_are_offered(client, agent):
    async with SessionLocal() as s:
        s.add_all([_customer("CLI-T-DEMO", "pending_transfer_overdue", "pt"), _customer("CLI-T-REAL", None)])
        await s.commit()
    try:
        offered = {c["customerId"]: c for c in (await client.get("/v1/test-chat/customers", headers={**agent, "X-Chatquiry-Locale": "en"})).json()}
        assert "CLI-T-DEMO" in offered and "CLI-T-REAL" not in offered
        assert offered["CLI-T-DEMO"]["hint"].startswith("Try: ") and offered["CLI-T-DEMO"]["firstName"] == "Marta"

        greeting = (await client.get("/v1/test-chat/customers/CLI-T-DEMO/greeting", headers=agent)).json()
        assert greeting[0]["author"] == "ai" and greeting[0]["text"].startswith("Olá, Marta")
        assert (await client.get("/v1/test-chat/customers/CLI-T-REAL/greeting", headers=agent)).status_code == 404
    finally:
        async with SessionLocal() as s:
            await s.execute(delete(Customer).where(Customer.customer_id.in_(["CLI-T-DEMO", "CLI-T-REAL"])))
            await s.commit()
