# vismuth

Клиническая поддержка принятия решений (CDS): backend (FastAPI) + frontend (Next.js) + ml-service.

## Быстрый старт

Нужен файл `.env` в этом каталоге:

```bash
docker compose up -d --build
```

- Frontend: http://localhost:3000 (порт из compose)
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs

## Документация

| Путь | Содержание |
|------|------------|
| [`docs/`](docs/) | Общие контракты API и домены |
| [`docs/contracts/overview.md`](docs/contracts/overview.md) | Старт для frontend / AI |
| [`AGENTS.md`](AGENTS.md) | Инструкции для агентов |
| [`backend/docs/`](backend/docs/) | Internals backend |
| [`backend/README.md`](backend/README.md) | Backend: старт и структура |
