# ruff: noqa: E402
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings, setup_logging

logger = logging.getLogger(__name__)

# Логирование настраиваем до импорта роутеров: сервисы грузят модели
# прямо при импорте и сразу пишут стартовые логи (app/llm_services/llm_setup.py).
setup_logging(settings.log)

from app.middleware import RequestLogMiddleware  # noqa: E402
from app.llm_services.llm_setup import log_available_models
from .autocomplete import router as autocomplete_router
from .clinrec import router as clinrec_router
from .collect_form import router as collect_form_router
from .dental_clarify import router as dental_clarify_router
from .mkb_code import router as mkb_router
from .protocol_fullness import router as protocol_fullness_router
from .summarize_form import router as summarize_form_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await log_available_models()
    logger.info("service started level=%s", settings.log.level)
    yield
    logger.info("service stopped")


app = FastAPI(title="Vismuth ML Service", lifespan=lifespan)
app.add_middleware(RequestLogMiddleware)
app.include_router(autocomplete_router)
app.include_router(mkb_router)
app.include_router(protocol_fullness_router)
app.include_router(clinrec_router)
app.include_router(collect_form_router)
app.include_router(summarize_form_router)
app.include_router(dental_clarify_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}
