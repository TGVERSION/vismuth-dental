FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml /app/pyproject.toml
RUN uv sync --no-install-project

COPY app /app/app

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.routers:app", "--host", "0.0.0.0", "--port", "8000"]
