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

`super_admin` — платформенная роль поставщика сервиса. Endpoint'ы `/super-admin/*` доступны **только** ей (`require_roles("super_admin")`).  
`admin` остаётся privileged для legacy CRUD users / general templates, но **не** видит супер-админку клиник.

## Клиника: роли через membership

Права внутри клиники **не** кодируются глобальной ролью `admin`:

- таблица `clinic_membership`: флаги `is_clinic_admin`, `is_doctor` (можно оба);
- приглашённый через invite получает глобальную роль `doctor` + membership с нужными флагами;
- API администратора клиники: `deps.require_clinic_admin` — `super_admin` **или** активный membership с `is_clinic_admin` (`/clinics/{id}/*`);
- раздел анкет врача: активный membership с `is_doctor` (`/questionnaires`).

Специализации врача: M2M `clinic_membership_specialization` ↔ `ref_specialization`.  
Публичная ссылка врача: `clinic_membership.public_slug`.

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
| `deps.require_roles("super_admin")` | `/super-admin/clinics*` |
| `deps.require_clinic_admin` | `/clinics/{clinic_id}*` |
| doctor membership | `/questionnaires*` |
