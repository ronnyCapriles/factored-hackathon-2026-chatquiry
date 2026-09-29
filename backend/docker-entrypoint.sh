#!/bin/sh
set -e

# One instance per database, so migrating on start is safe.
alembic upgrade head

if [ "${CQ_SEED_ON_START:-0}" = "1" ]; then
  python -m app.seed
fi

exec "$@"
