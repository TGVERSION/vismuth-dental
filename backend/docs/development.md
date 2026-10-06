# Разработка

## Новая таблица или колонка

1. **Не править** уже применённые миграции `0001`… на общих стендах/проде (ломает историю). Новые изменения — следующая ревизия после текущего head (`alembic current`).
2. Создать новую ревизию из `backend/`:

```bash
alembic revision -m "add_whatever"
```

3. Описать `upgrade()` / `downgrade()` в `alembic/versions/`.
4. **Длина `revision` id ≤ 32** (`alembic_version.version_num` — `VARCHAR(32)`).
5. Применить:

```bash
alembic upgrade head
# или пересобрать/перезапустить backend — entrypoint сам сделает upgrade
```

6. При необходимости добавить SQLAlchemy model в `app/models/` и экспорт в `models/__init__.py`.

## Новый HTTP endpoint

1. Schema в `app/schemas/` (Pydantic).
2. Router в `app/routers/` (или дополнить существующий).
3. Подключить в [`app/main.py`](../app/main.py): `app.include_router(...)`.
4. Для защищённых путей: `Depends(get_current_user)` / `require_clinic_admin` / … из [`deps.py`](../app/deps.py).
5. Обновить `docs/contracts/` + [`api.md`](api.md) в той же задаче.
6. Проверить в Swagger `/docs`.

## Новый справочник `ref_*`

1. Миграция Alembic: `CREATE TABLE ref_...`.
2. При необходимости строка в реестр `dictionary` (OID + имя таблицы).
3. CSV → [`sql/seed/ref/<table>.csv`](../sql/seed/ref/) (колонки = имена полей таблицы, UTF-8, `,`).
4. Whitelist и поля поиска в [`dictionaries_config.py`](../app/dictionaries_config.py) (`REF_TABLES`, `SEARCH_FIELDS`).
5. Список таблиц в [`sql/seed/seed_refs.py`](../sql/seed/seed_refs.py) (`REF_TABLES`).
6. Seed идемпотентен **по таблице**: пустая таблица заливается, непустая пропускается. На уже заполненной БД после деплоя новой таблицы достаточно:

```bash
docker compose exec backend python sql/seed/seed_refs.py
```

## Локальные полезные команды

```bash
# логи API
docker compose logs -f backend

# логи workers
docker compose logs -f backend-worker
docker compose logs -f questionnaire-worker

# статус миграций
docker compose exec backend alembic current

# пересборка backend + workers
docker compose up -d --build backend backend-worker questionnaire-worker
```

## Manual smoke (endpoints)

Ручная проверка живого API через Jupyter + Python-модули (не pytest).

Структура [`smoke_test/`](../smoke_test/):

| Файл | Назначение |
|------|------------|
| `_client.py` | `SmokeContext` (Session + cookies), `print_response`, login/register/refresh/logout |
| `groups/*.py` | suites по группам роутеров (`run_*`), в т.ч. `questionnaire.py` |
| `test_endpoints.ipynb` | тонкий runner backend (`localhost:8000`) |
| `ml_service.py` + `test_ml_endpoints.ipynb` | прямой smoke ml-service (`:8001`) |
| `smtp_check.py` + `test_smtp.ipynb` | проверка SMTP |

Как запускать:

1. `docker compose up -d` из корня `vismuth/`.
2. Открыть `smoke_test/test_endpoints.ipynb`, cwd kernel = `backend/smoke_test/` (или `backend/`).
3. Задать `email`/`password` в ячейке setup → `login(ctx)` (или register → код с почты → confirm).
4. Гонять секции по одной (`groups.protocols.run_all(ctx)`, `questionnaire.run_setup_clinic_with_doctor(ctx)`, …) или подряд сверху вниз.

Секция анкеты (в notebook) требует JWT `super_admin` на setup; дальше ctx переключается на врача. После primary: `run_doctor_list` (poll `processing_status`) → `run_process` → `run_create_protocol`. Для протокола заранее создайте structure (`protocol_structures.run_crud(..., delete=False)`).
