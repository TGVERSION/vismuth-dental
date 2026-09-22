# Роли и права доступа

## Модель данных

```text
service_user 1 ── 1 service_user_role N ── 1 role
```

- Таблица `role`: `id`, `name` (код), `name_ru` (подпись).
- Таблица `service_user_role`: PK = `user_id` → **пока одна роль на пользователя**.
- Колонки `service_user.role` больше нет (миграция `0006_roles`).

Код: `backend/app/models/role.py`, `backend/app/models/service_user.py`, `backend/app/services/roles.py`.

## Справочник ролей

| `name` | `name_ru` | Privileged сейчас |
|--------|-----------|-------------------|
| `super_admin` | Супер-админ | да (как бывший `administrator`) |
| `admin` | Админ | да (замена `administrator`) |
| `doctor` | Врач | нет |
| `patient` | Пациент | нет (права позже) |

`PRIVILEGED_ROLE_NAMES = { super_admin, admin }`.

`super_admin` — отдельная роль под будущие расширенные права; пока по доступу совпадает с `admin`.

## Миграция старых значений

| Было | Стало |
|------|--------|
| `administrator` | `admin` |
| `head_of_department` | `admin` |
| `doctor` | `doctor` |
| прочее | `admin` |

## API для UI

- У пользователя в ответах: `role` + `role_name_ru`.
- Справочник: `GET /roles` → список `{ name, name_ru }` (любой JWT).
- Назначение роли: privileged `PUT`/`PATCH /service_user/{id}` с полем `role` (код).
- Регистрация: роль из `DEFAULT_USER_ROLE` (обычно `doctor`).

## Frontend (рекомендации)

1. Не хардкодить список ролей и подписи — брать из `GET /roles`.
2. В списках пользователей показывать `role_name_ru`, в PATCH отправлять `role` (код).
3. Не строить route-guards на frontend как единственную защиту: проверка на backend. UI может скрывать admin-действия, опираясь на `role` текущего user.

## Где проверяется privileged

| Место | Правило |
|-------|---------|
| `deps.require_privileged` | CRUD service_user |
| `user_settings._ensure_access` | свой user **или** privileged |
| `protocol_templates` | `privacy=general` create/update/delete |
