# Vismuth Backend

FastAPI-сервис клинической поддержки принятия решений (CDS): протоколы, справочники, auth, proxy к ML.

В Docker Compose это сервисы `backend` (HTTP API) и `backend-worker` (обработка событий из Redis). Порт API по умолчанию: **8000**.

## Быстрый старт

Из корня репозитория `vismuth/` (нужен файл `.env`):

```bash
docker compose up -d --build
```

Проверки:

- Health: http://localhost:8000/health
- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

При старте контейнера entrypoint:

1. ждёт Postgres;
2. `alembic upgrade head`;
3. `python -m scripts.seed_refs` (если справочники ещё пустые);
4. запускает CMD (`uvicorn` или worker).

## Структура каталогов

```
backend/
  app/                 # код приложения
    routers/           # HTTP endpoints
    models/            # SQLAlchemy
    schemas/           # Pydantic
    services/          # ML proxy, Redis
    workers/           # consumer Redis Stream
  alembic/             # миграции схемы БД
  scripts/             # entrypoint, seed_refs
  sql/seed/ref/        # CSV справочников
  docs/                # эта документация
```

## Документация

| Документ | О чём |
|----------|--------|
| [../docs/contracts/](../docs/contracts/) | **Контракты API** (поведение для frontend / агентов) |
| [../docs/domains/](../docs/domains/) | Доменные модели (роли и права) |
| [../AGENTS.md](../AGENTS.md) | Инструкции для AI-агентов |
| [docs/architecture.md](docs/architecture.md) | Слои приложения, docker-процессы, зависимости |
| [docs/configuration.md](docs/configuration.md) | Переменные окружения |
| [docs/database.md](docs/database.md) | Alembic, seed, деплой на существующую БД |
| [docs/api.md](docs/api.md) | Индекс групп API + ссылки на contracts |
| [docs/ml-and-worker.md](docs/ml-and-worker.md) | Proxy на ml-service, Redis, worker |
| [docs/development.md](docs/development.md) | Как добавлять миграции, endpoints, справочники |
| [sql/README.md](sql/README.md) | Краткая шпаргалка по migrate/seed |

Детали request/response — в Swagger (`/docs`). Поведение endpoint'ов — в `vismuth/docs/contracts/`.
