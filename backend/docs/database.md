# База данных

Source of truth схемы: [`alembic/versions/`](../alembic/versions/). Старый `main_schema.sql` удалён.

Краткая шпаргалка команд: [`sql/README.md`](../sql/README.md).

## Базовые миграции

| Revision | Содержание |
|----------|------------|
| `0001_extensions_and_ref_tables` | `pgcrypto`, `dictionary`, все `ref_*` |
| `0002_users_and_auth` | `service_user`, `registration_pending`, `user_settings` |
| `0003_protocol_catalog` | `protocol_fields_main`, `protocol_structures`, `protocol_structures_fields` |
| `0004_protocols_and_templates` | `protocols`, `protocol_fields`, шаблоны и группы |
| `0005_ml_tables_and_functions` | stats/logs, `ml_unigrams`/`ml_bigrams`, SQL-функции autocomplete |
| `0006_roles` | справочник `role` (`name`, `name_ru`), связь `service_user_role` (1 роль на user), drop `service_user.role` |

Порядок важен из‑за FK (`service_user` раньше протоколов и т.д.).

### Роли пользователей

- Таблица `role`: код `name` + отображаемое имя `name_ru` (`super_admin` / Супер-админ, `admin` / Админ, `doctor` / Врач, `patient` / Пациент).
- Таблица `service_user_role`: PK = `user_id` → пока **одна** роль на пользователя.
- Миграция данных: `administrator` / `head_of_department` → `admin`, `doctor` → `doctor`.
- Privileged (CRUD users, чужие settings, general templates): `super_admin` или `admin`.

## Команды (из каталога `backend/` или контейнера)

```bash
alembic upgrade head
alembic downgrade -1
alembic current
alembic history
python -m scripts.seed_refs
```

В Docker:

```bash
docker compose exec backend alembic current
docker compose exec backend python -m scripts.seed_refs
```

## Seed справочников

- CSV: [`sql/seed/ref/*.csv`](../sql/seed/ref/) — имена таблиц без timestamp.
- Скрипт: [`scripts/seed_refs.py`](../scripts/seed_refs.py) — `nan` → NULL, `COPY`, `setval` для `row_id`.
- Идемпотентность: если в `ref_mkb10` уже есть строки → **весь seed пропускается**.

Entrypoint вызывает seed после каждой миграции; на заполненной БД это no-op.

## Fresh volume

```bash
# из корня vismuth/ — сотрёт данные Postgres!
docker compose down -v
docker compose up -d --build
```

На пустой БД: `upgrade head` создаст схему, seed зальёт ~28k строк справочников.

## Деплой на сервер со старой БД (до Alembic)

Данные в Docker volume **сохранятся**, если не делать `down -v`.

1. Сделать бэкап:

```bash
docker compose exec -T db pg_dump -U vismuth vismuth > backup_$(date +%F).sql
```

2. После `git pull` и rebuild:

- таблица `alembic_version` на старой БД отсутствует;
- entrypoint вызовет `alembic upgrade head` и попытается прогнать `0001`…`0006`;
- из‑за `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING` на совпадающей схеме обычно проходит «вхолостую»;
- seed увидит `ref_mkb10` и **не перезапишет** справочники.

3. Если схема уже полная и совпадает с миграциями — безопаснее один раз пометить head **без** повторного DDL:

```bash
docker compose run --rm backend alembic stamp head
```

(либо после успешного первого `upgrade` проверить `alembic current` → `0006_roles`).

4. Таблица вроде старого `ref_mis` на сервере **не удаляются** автоматически — просто больше не создаются новыми миграциями.
