from fastapi import FastAPI

from .routers.autocomplete import router as autocomplete_router


app = FastAPI(title="Vismuth ML Service")
app.include_router(autocomplete_router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}
