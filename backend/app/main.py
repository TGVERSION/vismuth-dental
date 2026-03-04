from fastapi import FastAPI

from .config import settings


app = FastAPI(title="Vismuth Clinical Decision Support")


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}


@app.get("/config/db", tags=["system"])
async def db_config_preview():
    return {
        "postgres_db": settings.postgres_db,
        "postgres_user": settings.postgres_user,
        "postgres_host": settings.postgres_host,
        "postgres_port": settings.postgres_port,
    }

