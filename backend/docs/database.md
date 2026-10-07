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
| `0007_clinics` | `clinic`, `clinic_membership`, `clinic_invitation` (тенанты, участники, invite) |
| `0008_specializations` | `ref_specialization`, M2M специализаций, `middle_name`, `membership.public_slug` |
| `0009_questionnaires` | `questionnaire`, `questionnaire_answer`, связь протокол↔анкета |
| `0010_refresh_tokens` | `refresh_token` — opaque refresh (hash), rotation, revoke |
| `0011_collect_form_state` | `questionnaire.collect_form_state` JSONB — FormProgress из `/collect_form` |

Порядок важен из‑за FK (`service_user` раньше протоколов и т.д.).

### Роли пользователей

- Таблица `role`: код `name` + отображаемое имя `name_ru` (`super_admin` / Супер-админ, `admin` / Админ, `doctor` / Врач, `patient` / Пациент).
- Таблица `service_user_role`: PK = `user_id` → пока **одна** роль на пользователя.
- Миграция данных: `administrator` / `head_of_department` → `admin`, `doctor` → `doctor`.
- Privileged (CRUD users, чужие settings, general templates): `super_admin` или `admin`.
- API `/super-admin/*` — только `super_admin` (не `admin`).

### Клиники, специализации и анкеты (0007–0009)

| Таблица | Суть |
|--------|------|
| `clinic` | Тенант: name, phone, email, logo_url, brand_color, doctors_limit, access_until, access_type (`trial`\|`paid`), public_slug; timestamps |
| `clinic_membership` | user↔clinic: `is_clinic_admin`, `is_doctor`, status (`active`\|`deactivated`), photo_url, **public_slug**; timestamps |
| `clinic_invitation` | Invite: email, ФИО (+ middle_name), photo_url, token_hash, роли, expires_at, used_at; soft-delete = revoke |
| `ref_specialization` | Справочник специализаций (seed CSV) |
| `clinic_membership_specialization` / `clinic_invitation_specialization` | M2M специализаций |
| `questionnaire` | Анкета пациента: шаги, `code` CHAR(4), AI-флаги, patient info, protocol_id, `structured`/`gaps`/`processing_status` (после `/summarize_form`), `collect_form_state` (FormProgress `/collect_form`, не в API) |
| `questionnaire_answer` | Реплики/ответы (CASCADE) |

Статус подписки **не хранится** — вычисляется по `access_until` + `access_type`.

`protocols.source_questionnaire_id` (SET NULL) + `created_from_questionnaire` — связь с анкетой.

### Refresh tokens (0010)

| Таблица | Суть |
|--------|------|
| `refresh_token` | Opaque refresh: `token_hash` (sha256), `user_id`, `expires_at`, `revoked_at`, `replaced_by_id` (rotation chain) |

Raw token только в httpOnly cookie; в API body не отдаётся. Logout / refresh — [`services/refresh_tokens.py`](../app/services/refresh_tokens.py).

## Команды (из каталога `backend/` или контейнера)

```bash
alembic upgrade head
alembic downgrade -1
alembic current
alembic history
python sql/seed/seed_refs.py
```

В Docker:

```bash
docker compose exec backend alembic current
docker compose exec backend python sql/seed/seed_refs.py
```

## Seed справочников

- CSV: [`sql/seed/ref/*.csv`](../sql/seed/ref/) — имена таблиц без timestamp.
- Скрипт: [`sql/seed/seed_refs.py`](../sql/seed/seed_refs.py) — `nan` → NULL, `COPY`, `setval` для `row_id`.
- Идемпотентность: **каждая** таблица из `REF_TABLES` сидится отдельно; если в таблице уже есть строки — она пропускается. Новые справочники (например `ref_specialization`) заливаются на уже заполненной БД без очистки остальных refs.

Entrypoint вызывает seed после каждой миграции; на полностью заполненных refs это no-op.

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
- entrypoint вызовет `alembic upgrade head` и попытается прогнать `0001`…head;
- из‑за `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING` на совпадающей схеме обычно проходит «вхолостую»;
- seed заполнит только **пустые** `ref_*` (уже заполненные не трогает).

3. Если схема уже полная и совпадает с миграциями — безопаснее один раз пометить head **без** повторного DDL:

```bash
docker compose run --rm backend alembic stamp head
```

(либо после успешного первого `upgrade` проверить `alembic current` → `0009_questionnaires`).

4. Таблицы вроде старого `ref_mis` на сервере **не удаляются** автоматически — просто больше не создаются новыми миграциями.
