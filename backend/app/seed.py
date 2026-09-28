"""Loads the default workspace. Safe to run repeatedly: config is replaced, staff are upserted."""

import asyncio
import os
from pathlib import Path

import yaml
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password, new_api_key
from app.models import AiProfile, ApiKey, Channel, Connector, Department, Guardrail, IntakeSignal, Organization, Policy, RoutingRule, StaffUser, Tool, Workspace

SEED_FILE = Path(__file__).resolve().parents[1] / "seed" / "workspace.yaml"
NOTIFICATIONS = {"new_handoff": True, "desktop": True, "sound": False, "daily_summary": True}


async def seed() -> None:
    data = yaml.safe_load(SEED_FILE.read_text())
    password = os.environ.get("CQ_SEED_PASSWORD") or ("demo-demo" if not get_settings().is_prod else None)
    if not password:
        raise SystemExit("CQ_SEED_PASSWORD is required in production")

    org, ws = data["organization"], data["workspace"]
    tenant = {"org_id": org["id"], "workspace_id": ws["id"]}

    async with SessionLocal() as s:
        if not await s.get(Organization, org["id"]):
            s.add(Organization(**org))
        if not await s.get(Workspace, ws["id"]):
            s.add(Workspace(org_id=org["id"], **ws))
        await s.flush()

        for model in (Department, AiProfile, Tool, RoutingRule, Policy, Guardrail, IntakeSignal, Channel, Connector):
            await s.execute(delete(model).where(model.workspace_id == ws["id"]))

        password_hash = hash_password(password)
        for row in data["staff"]:
            user = await s.get(StaffUser, row["id"])
            fields = {"notifications": NOTIFICATIONS, "availability": "available", "greeting": "", "specialty": None, **row, **tenant}
            if user:
                for k, v in fields.items():
                    setattr(user, k, v)
            else:
                s.add(StaffUser(password_hash=password_hash, **fields))

        s.add_all(AiProfile(**tenant, **p) for p in data["profiles"])
        s.add_all(Department(**tenant, **d) for d in data["departments"])
        s.add_all(Tool(**tenant, **t) for t in data["tools"])
        s.add_all(IntakeSignal(**tenant, **x) for x in data["signals"])
        s.add_all(RoutingRule(**tenant, **r) for r in data["routing"])
        s.add_all(Policy(**tenant, **p) for p in data["policies"])
        s.add(Guardrail(**tenant, **data["guardrail"]))
        s.add_all(Channel(**tenant, **c) for c in data["channels"])
        s.add_all(Connector(**tenant, **c) for c in data["connectors"])

        created_key = None
        if not await s.scalar(select(ApiKey).where(ApiKey.workspace_id == ws["id"])):
            key, prefix, key_hash = new_api_key("test")
            s.add(ApiKey(id="KEY-TEST", name="Evaluation", prefix=prefix, key_hash=key_hash, environment="test", scopes=["conversations:write"], **tenant))
            created_key = key

        await s.commit()

    print(f"seeded workspace {ws['id']}")
    if created_key:
        print(f"test API key (shown once): {created_key}")


if __name__ == "__main__":
    asyncio.run(seed())
