from fastapi import FastAPI

from . import models  # noqa: F401
from .config import settings
from .routers.auth import router as auth_router
from .routers.consultations import router as consultations_router
from .routers.mkb10 import router as mkb10_router
from .routers.ml_mkb_code import router as ml_mkb_code_router
from .routers.protocol_templates import router as protocol_templates_router
from .routers.template_groups import router as template_groups_router


app = FastAPI(title="Vismuth Clinical Decision Support")

app.include_router(auth_router)
app.include_router(consultations_router)
app.include_router(mkb10_router)
app.include_router(ml_mkb_code_router)
app.include_router(template_groups_router)
app.include_router(protocol_templates_router)


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

