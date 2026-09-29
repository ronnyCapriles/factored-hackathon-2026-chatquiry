# syntax=docker/dockerfile:1.7
# Targets: dev (hot reload, source mounted by compose) and prod (slim image pushed to ECR).

FROM python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/
# The virtualenv lives outside /app so mounting the source in dev does not hide it.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH
ARG UID=1000
RUN useradd --create-home --uid ${UID} app
WORKDIR /app
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]

FROM base AS dev
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project
COPY --chown=app:app . .
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"]

FROM base AS prod
ENV UV_COMPILE_BYTECODE=1
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev
COPY --chown=app:app docker-entrypoint.sh alembic.ini ./
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app seed ./seed
COPY --chown=app:app app ./app
USER app
ENV CQ_ENV=prod
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
