"""Local dev runner: python -m app (from project root, no Docker needed)."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.routers:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
    )
