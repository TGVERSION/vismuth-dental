# Vismuth Backend

FastAPI-сервис клинической поддержки принятия решений (CDS): протоколы, клиники, анкеты пациента, справочники, auth, proxy к ML.

В Docker Compose:

| Сервис | Роль |
|--------|------|
| `backend` | HTTP API (порт **8000**) |
| `backend-worker` | события ML из Redis Stream |
| `questionnaire-worker` | retention анкет (abandon 24h / purge 45d) |

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
3. `python sql/seed/seed_refs.py` (заливает только пустые `ref_*`);
4. запускает CMD (`uvicorn` или worker).

## Структура каталогов

```
backend/
  app/                 # код приложения
    routers/           # HTTP endpoints (+ public_questionnaire, clinic_admin, questionnaires)
    models/            # SQLAlchemy
    schemas/           # Pydantic
    services/          # ML proxy, Redis, clinic_members, questionnaire_*
    workers/           # ml_mkb_events_worker, questionnaire_maintenance
  alembic/             # миграции схемы БД
  sql/seed/            # CSV справочников + seed_refs.py
  smoke_test/          # Jupyter smoke API
  entrypoint.sh        # wait PG → migrate → seed → CMD
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
| [docs/ml-and-worker.md](docs/ml-and-worker.md) | Proxy на ml-service, Redis, workers |
| [docs/development.md](docs/development.md) | Как добавлять миграции, endpoints, справочники, smoke |
| [sql/README.md](sql/README.md) | Краткая шпаргалка по migrate/seed |

Детали request/response — в Swagger (`/docs`). Поведение endpoint'ов — в `vismuth/docs/contracts/`.
