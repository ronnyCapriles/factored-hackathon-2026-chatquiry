import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, channel, handling, service, test_chat
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

settings = get_settings()
app = FastAPI(title="Chatquiry API", version="0.1.0", docs_url=None if settings.is_prod else "/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Chatquiry-Locale", "X-Api-Key", "X-Customer-Assertion"],
)

app.include_router(auth.router)
app.include_router(service.router)
app.include_router(admin.router)
app.include_router(test_chat.router)
app.include_router(channel.router)
app.include_router(handling.router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
