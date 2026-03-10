from fastapi import FastAPI

from . import models  # noqa: F401
from .config import settings
from .routers.consultations import router as consultations_router
from .routers.service_users import router as service_users_router


app = FastAPI(title="Vismuth Clinical Decision Support")

app.include_router(consultations_router)
app.include_router(service_users_router)


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

