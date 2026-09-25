"""Local dev runner.

Можно запускать откуда угодно:
    python app/__main__.py
    python -m app
"""
import os
import sys
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if __name__ == "__main__":
    uvicorn.run(
        "app.routers:app",
        host=os.getenv("ML_HOST", "0.0.0.0"),
        port=int(os.getenv("ML_PORT", "8080")),
        reload=os.getenv("ML_RELOAD", "1") == "1",
    )
