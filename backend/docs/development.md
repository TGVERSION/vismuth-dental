# Разработка

## Новая таблица или колонка

1. **Не править** уже применённые миграции `0001`…`0005` на общих стендах/проде (ломает историю).
2. Создать новую ревизию из `backend/`:

```bash
alembic revision -m "add_whatever"
```

3. Описать `upgrade()` / `downgrade()` в `alembic/versions/`.
4. Применить:

```bash
alembic upgrade head
# или пересобрать/перезапустить backend — entrypoint сам сделает upgrade
```

5. При необходимости добавить SQLAlchemy model в `app/models/` и экспорт в `models/__init__.py`.

## Новый HTTP endpoint

1. Schema в `app/schemas/` (Pydantic).
2. Router в `app/routers/` (или дополнить существующий).
3. Подключить в [`app/main.py`](../app/main.py): `app.include_router(...)`.
4. Для защищённых путей: `Depends(get_current_user)` из [`deps.py`](../app/deps.py).
5. Проверить в Swagger `/docs`.

## Новый справочник `ref_*`

1. Миграция Alembic: `CREATE TABLE ref_...`.
2. Строка в реестр `dictionary` (OID + имя таблицы) — в той же или следующей миграции.
3. CSV → [`sql/seed/ref/<table>.csv`](../sql/seed/ref/) (колонки = имена полей таблицы, UTF-8, `,`).
4. Whitelist и поля поиска в [`dictionaries_config.py`](../app/dictionaries_config.py) (`REF_TABLES`, `SEARCH_FIELDS`).
5. Список таблиц в [`scripts/seed_refs.py`](../scripts/seed_refs.py) (`REF_TABLES`).
6. На пустой БД seed подхватит файл; на уже заполненной `ref_mkb10` автоматический seed **не** зальёт новый CSV — импорт вручную:

```bash
# временно очищать refs нельзя на проде; для локалки:
# либо TRUNCATE нужной таблицы и python -m scripts.seed_refs
# (seed сейчас выходит сразу, если ref_mkb10 непустой —
#  для одной новой таблицы может понадобиться точечный COPY)
docker compose exec backend python -m scripts.seed_refs
```

Учтите: текущий seed при непустом `ref_mkb10` пропускает **все** таблицы. Для добавления одного нового справочника на живую БД обычно делают одноразовый импорт или дорабатывают скрипт.

## Локальные полезные команды

```bash
# логи API
docker compose logs -f backend

# логи worker
docker compose logs -f backend-worker

# статус миграций
docker compose exec backend alembic current

# пересборка только backend
docker compose up -d --build backend backend-worker
```

## Тесты endpoints

В репозитории есть Jupyter-ноутбук [`test_ipynb/test_endpoints.ipynb`](../test_ipynb/test_endpoints.ipynb) для ручной проверки API.
