# AGENTS.md — Vismuth

Инструкции для AI-агентов (Cursor, Codex, Claude Code) и людей, меняющих код через них.

## Карта репозитория

| Путь | Назначение |
|------|------------|
| `backend/` | FastAPI, Alembic, workers (ML events + questionnaire retention) |
| `frontend/` | Next.js UI |
| `ml-service/` | LLM / ML endpoints (в т.ч. `/collect_form` для анкеты) |
| `docs/` | Общие контракты API и домены |
| `backend/docs/` | Internals backend (env, DB, архитектура процессов) |
| `docker-compose.yml`, `.env` | Локальный стек |

## Документация: что читать

1. **Контракты API (поведение):** [`docs/contracts/overview.md`](docs/contracts/overview.md) → нужный файл в `docs/contracts/` (анкета: `questionnaire-public.md`, `questionnaires.md`, `clinic-admin.md`).
2. **Роли и права:** [`docs/domains/roles-and-permissions.md`](docs/domains/roles-and-permissions.md).
3. **Точные схемы полей:** Swagger `http://localhost:8000/docs` — не копировать OpenAPI в markdown.
4. **Internals backend:** `backend/docs/` (architecture, database, configuration, ml-and-worker).

Оглавление docs: [`docs/README.md`](docs/README.md).

## Правила при изменениях

### Backend (`backend/app/routers`, schemas, roles)

- Обнови соответствующий файл в `docs/contracts/` в **той же** задаче.
- При смене ролей/прав — обнови `docs/domains/roles-and-permissions.md` и `backend/docs/*`.
- Новые таблицы — Alembic revision (не править уже применённые `0001`… на общих стендах); **id ревизии ≤ 32 символов**.

### Frontend (API-клиент, settings, auth store)

- Перед правкой прочитай `docs/contracts/overview.md` и профильный contract.
- **Не хардкодить** список ролей и кириллические подписи: `GET /roles` → `name` / `name_ru`.
- В PATCH роли отправляй код (`role`), для отображения используй `role_name_ru` или label из `/roles`.
- Access control на UI — удобство; источник правды — backend.
- Публичная анкета: state machine на backend (`/public/*`); UI только рендерит `step` и шлёт answer + headers `X-Device-Id` / `X-Questionnaire-Token`.

### Общее

- Пиши docs по-русски, коротко.
- Не дублируй полный OpenAPI в md.
- Breaking change — явная пометка вверху файла контракта.

## Быстрый старт стека

Из `vismuth/`:

```bash
docker compose up -d --build
```

Миграции: entrypoint backend → `alembic upgrade head`.
