"""Creates an API key for a bank's system, such as the evaluation harness. The key is printed once and only its hash is kept."""

import argparse
import asyncio

from app.core.db import SessionLocal
from app.core.security import new_api_key
from app.models import ApiKey, Workspace


async def create(name: str, environment: str, workspace_id: str) -> None:
    async with SessionLocal() as s:
        workspace = await s.get(Workspace, workspace_id)
        if not workspace:
            raise SystemExit(f"unknown workspace {workspace_id}")
        key, prefix, key_hash = new_api_key(environment)
        s.add(
            ApiKey(
                id=f"KEY-{prefix.split('_')[-1].upper()}",
                name=name,
                prefix=prefix,
                key_hash=key_hash,
                environment=environment,
                scopes=["conversations:write"],
                org_id=workspace.org_id,
                workspace_id=workspace.id,
            )
        )
        await s.commit()
    print(key)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", default="Evaluation")
    parser.add_argument("--environment", choices=["test", "live"], default="test")
    parser.add_argument("--workspace", default="WS-DEFAULT")
    args = parser.parse_args()
    asyncio.run(create(args.name, args.environment, args.workspace))


if __name__ == "__main__":
    main()
