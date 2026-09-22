from fastapi import FastAPI

from . import models  # noqa: F401
from .routers.auth import router as auth_router
from .routers.dictionaries import router as dictionaries_router
from .routers.mkb10 import router as mkb10_router
from .routers.ml_autocomplete import router as ml_autocomplete_router
from .routers.ml_clinrec_check import router as ml_clinrec_check_router
from .routers.ml_mkb_code import router as ml_mkb_code_router
from .routers.ml_fullness import router as ml_fullness_router
from .routers.protocol_fields_main import router as protocol_fields_main_router
from .routers.protocols import router as protocols_router
from .routers.protocol_structures import router as protocol_structures_router
from .routers.protocol_templates import router as protocol_templates_router
from .routers.service_user import router as service_user_router
from .routers.template_groups import router as template_groups_router
from .routers.ml_autocomplete_dict import router as ml_complete_router
from .routers.user_settings import router as user_settings_router


app = FastAPI(title="Vismuth Clinical Decision Support")

app.include_router(auth_router)
app.include_router(dictionaries_router)
app.include_router(mkb10_router)
app.include_router(ml_autocomplete_router)
app.include_router(ml_clinrec_check_router)
app.include_router(ml_mkb_code_router)
app.include_router(ml_fullness_router)
app.include_router(service_user_router)
app.include_router(template_groups_router)
app.include_router(protocol_templates_router)
app.include_router(protocol_structures_router)
app.include_router(protocol_fields_main_router)
app.include_router(protocols_router)
app.include_router(ml_complete_router)
app.include_router(user_settings_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}
