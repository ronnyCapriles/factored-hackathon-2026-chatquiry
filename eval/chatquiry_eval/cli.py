"""cq-eval setup | run: play the scenarios through the bank-facing API, grade them, write the report."""

import argparse
import asyncio
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from chatquiry_eval import config, report
from chatquiry_eval.graders import grade
from chatquiry_eval.runner import Runner
from chatquiry_eval.scenarios import customers, load

DEFAULT_SCENARIOS = config.EVAL / "scenarios" / "demo-bank.yaml"


def setup(settings: config.Settings) -> None:
    """The harness plays a bank: it signs customer assertions with its own key, and the API trusts the public half."""
    path = settings.private_key
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        os.chmod(path, 0o600)
        print(f"created {path}")
    private = serialization.load_pem_private_key(path.read_bytes(), password=None)
    public = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    print("\nAdd to the repository's .env, then restart the API (docker compose up -d api):")
    print("CUSTOMER_ASSERTION_PUBLIC_KEY=" + public.strip().replace("\n", "\\n"))
    print("\nCreate the harness's API key and add it to .env as EVAL_API_KEY:")
    print("docker compose exec api python -m app.keys --name Evaluation")


async def run(settings: config.Settings, scenarios_path: Path, runs: int, concurrency: int, only: list[str]) -> int:
    if not settings.api_key:
        sys.exit("EVAL_API_KEY is not set; see `cq-eval setup`")
    scenarios = [s for s in load(scenarios_path) if not only or s.id in only]
    known = customers(settings.meta)
    started = datetime.now(UTC)
    gate = asyncio.Semaphore(concurrency)
    async with Runner(settings, known) as runner:

        async def one(scenario, attempt):
            async with gate:
                played = await runner.play(scenario, attempt)
            checks = grade(scenario, played)
            ok = all(c.passed for c in checks)
            unsafe = any(c.safety and not c.passed for c in checks)
            failed = ", ".join(c.name for c in checks if not c.passed)
            print(f"{'✓' if ok else '✗'} {scenario.id} #{attempt}{' UNSAFE' if unsafe else ''}{f'  [{failed}]' if failed else ''}", flush=True)
            return scenario, played, checks

        graded = await asyncio.gather(*(one(s, a) for s in scenarios for a in range(1, runs + 1)))

    summary = report.summarize(list(graded), base_url=settings.base_url, runs=runs, started=started)
    path = report.write(summary, scenarios)
    k = summary["kpis"]
    print(f"\nsafe resolution {k['safe_resolution']} · containment {k['containment']} · missed/unnecessary {k['handoff_quality']}")
    print(f"unsafe {k['unsafe']} · latency p50/p95 {k['latency']} · cost {k['cost']} · routing {summary['routing_accuracy']}")
    print(f"report: {path}")
    return 0 if not any(r["unsafe"] for r in summary["results"]) else 1


def main() -> None:
    parser = argparse.ArgumentParser(prog="cq-eval", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("setup", help="create the harness's signing key and print the settings the API needs")
    play = sub.add_parser("run", help="play, grade and report")
    play.add_argument("--scenarios", type=Path, default=DEFAULT_SCENARIOS)
    play.add_argument("--runs", type=int, default=3)
    play.add_argument("--concurrency", type=int, default=3)
    play.add_argument("--only", nargs="*", default=[])
    args = parser.parse_args()
    settings = config.load()
    if args.command == "setup":
        setup(settings)
    else:
        sys.exit(asyncio.run(run(settings, args.scenarios, args.runs, args.concurrency, args.only)))
