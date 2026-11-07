# Документация Vismuth

Общий слой документации репозитория `vismuth/` (backend + frontend + AI-агенты).

## Куда смотреть

| Путь | Для кого | Содержание |
|------|----------|------------|
| [`contracts/`](contracts/) | Frontend, backend, агенты | Поведение API: auth, роли, endpoint'ы |
| [`domains/`](domains/) | Все | Доменные модели (роли, права) |
| [`../backend/docs/`](../backend/docs/) | Backend | Internals: Alembic, env, архитектура процессов |
| Swagger `http://localhost:8000/docs` | Все | Точные схемы request/response |

**Правило:** markdown = смысл и поведение; OpenAPI = поля и типы. Не дублировать полный OpenAPI в md.

## Контракты API

Оглавление: [`contracts/overview.md`](contracts/overview.md).

Шаблон секции endpoint: [`contracts/_template.md`](contracts/_template.md).

## Для AI-агентов (Cursor / Codex / Claude Code)

См. корневой [`../AGENTS.md`](../AGENTS.md).

Кратко:

1. Перед правкой frontend API-клиента / settings — прочитай `contracts/overview.md` и нужный файл в `contracts/`.
2. Перед правкой backend router/schema — обнови соответствующий `contracts/*.md` в той же задаче.
3. Роли сотрудников не хардкодить на UI: `GET /clinic-roles` (`value` + `label`), одно поле «Роль». `GET /roles` — служебная совместимость.

## Интерфейс

[Дизайн-система VISMUTH и проверка компонентов](frontend/design-system.md).
