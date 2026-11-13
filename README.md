# vismuth

Клиническая поддержка принятия решений (CDS): backend (FastAPI) + frontend (Next.js) + ml-service.

## Быстрый старт

Нужен файл `.env` в этом каталоге:

```bash
docker compose up -d --build
```

- Frontend: http://localhost:3000 (порт из `.env`: `FRONTEND_PORT`)
- Backend API: http://localhost:8000 (`BACKEND_PORT`)
- Swagger: http://localhost:8000/docs
- ml-service: http://localhost:8001 (`ML_SERVICE_PORT`)
- MinIO/Silo (PDF клинреков): API http://localhost:9000 (`MINIO_API_PORT`), консоль http://localhost:9001 (`MINIO_CONSOLE_PORT`)

Порты на хосте задаются в `.env`; внутри docker-сети они фиксированы, поэтому при занятом порте достаточно поменять переменную и перезапустить `docker compose up -d`.

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
| [`docs/contracts/gastro-questionnaire.md`](docs/contracts/gastro-questionnaire.md) | Первичная гастроанкета: сценарий, данные, ИИ и ограничения |
| [`scripts/qa/README.md`](scripts/qa/README.md) | Синтетическая браузерная проверка гастроанкеты |

## Первичная гастроанкета

Для взрослого гастроэнтеролога при выборе первичного приёма публичная ссылка
врача/клиники открывает отдельный кнопочный сценарий. Возраст и время приёма
не запрашиваются. Длинную историю можно добавить своими словами либо по
подсказкам. Последний пункт — собственные вопросы пациента врачу; после него
только отправка и код. Стоматологический и остальные общие сценарии сохраняются.

Перед запуском backend применяются миграции до `0016_gastro_answers`; стандартный
entrypoint выполняет `alembic upgrade head`. Необязательный `/gastro_clarify`
использует отдельную инструкцию и существующий транспорт `DENTAL_LLM_*`.
Без настроенной модели форма работает без ИИ. Обратная миграция при наличии
гастроответов намеренно запрещена, чтобы не потерять данные.

Состав клинических вопросов и фиксированных срочных сообщений требует проверки
клиникой; анкета не является полным триажем и не оценивает безопасность ожидания.
