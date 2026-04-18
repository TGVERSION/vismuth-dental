from fastapi import FastAPI

from .routers.autocomplete import router as autocomplete_router
from .routers.mkb_code import router as mkb_router
from .routers.protocol_fullness import router as protocol_fullness_router


app = FastAPI(title="Vismuth ML Service")
app.include_router(autocomplete_router)
app.include_router(mkb_router)
app.include_router(protocol_fullness_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}
