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
- MinIO/Silo (PDF клинреков): API http://localhost:9000, консоль http://localhost:9001

Опционально — наполнить бакет клиническими рекомендациями с Минздрава (идемпотентно):

```bash
docker compose up -d minio minio-init
./scripts/clinrec/run_download.sh
# smoke: ./scripts/clinrec/run_download.sh --limit 5
```

Подробности: [`scripts/clinrec/README.md`](scripts/clinrec/README.md).

## Документация

| Путь | Содержание |
|------|------------|
| [`docs/`](docs/) | Общие контракты API и домены |
| [`docs/contracts/overview.md`](docs/contracts/overview.md) | Старт для frontend / AI |
| [`AGENTS.md`](AGENTS.md) | Инструкции для агентов |
| [`backend/docs/`](backend/docs/) | Internals backend |
| [`backend/README.md`](backend/README.md) | Backend: старт и структура |
