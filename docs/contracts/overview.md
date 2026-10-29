# Обзор API-контракта

Точные схемы: Swagger `http://localhost:8000/docs`.  
Internals backend: [`../../backend/docs/`](../../backend/docs/).  
Роли подробно: [`../domains/roles-and-permissions.md`](../domains/roles-and-permissions.md).

## Базовый URL

В docker-compose frontend ходит в backend через rewrite `/api/main` → backend.  
Прямой backend: `http://localhost:8000`.

## Auth

Большинство endpoint'ов:

```http
Authorization: Bearer <access_token>
```

| Режим | Смысл |
|-------|--------|
| **none** | Публичный (register/login, invite preview/accept, часть dict-autocomplete, `/public/*` анкета) |
| **JWT** | Валидный токен → активный, не soft-deleted `service_user` |
| **privileged** | JWT + роль `super_admin` или `admin` |
| **super_admin** | JWT + роль `super_admin` (группа `/super-admin/*`) |
| **clinic_admin** | JWT + `super_admin` **или** membership `is_clinic_admin` в данной клинике |

Ошибки auth (типично): `401` не аутентифицирован / битый токен / user не найден / удалён; `403` inactive или нет прав.

Access JWT короткий (~15 мин). Длинная сессия — через **refresh cookie** (`POST /auth/refresh`, rotation). Logout отзывает refresh в БД и снимает cookie. Подробности: [auth.md](auth.md), гайд frontend: [../frontend/auth-refresh.md](../frontend/auth-refresh.md).

## Роли в ответах пользователя

| Поле | Смысл |
|------|--------|
| `role` | Код: `super_admin` \| `admin` \| `doctor` \| `patient` |
| `role_name_ru` | Подпись для UI (кириллица) |

Справочник для dropdown: `GET /roles` → `{ name, name_ru }[]`.

Старые коды `administrator`, `head_of_department` **невалидны**.

## Privileged-операции

Только `super_admin` | `admin`:

- CRUD других пользователей (`/service_user_ids`, `/service_user/{id}`, …)
- чужие `/user-settings/{user_id}`
- шаблоны протоколов с `privacy: general` (create / update / delete / смена privacy на general)

Только `super_admin`:

- `/super-admin/clinics*` (CRUD клиник, invitations)
- `/super-admin/statistics` (сводная статистика анкет)
- `/clinrec/guidelines` запись (POST/PATCH/DELETE/index)

## Группы контрактов

| Файл | Группа |
|------|--------|
| [auth.md](auth.md) | `/auth` (в т.ч. invitations, refresh cookie) |
| [../frontend/auth-refresh.md](../frontend/auth-refresh.md) | Чеклист для frontend (не контракт API) |
| [roles.md](roles.md) | `/roles` |
| [service-user.md](service-user.md) | `/service_user*` |
| [user-settings.md](user-settings.md) | `/user-settings` |
| [super-admin-clinics.md](super-admin-clinics.md) | `/super-admin/clinics` |
| [questionnaire-statistics.md](questionnaire-statistics.md) | `/clinics/{id}/statistics`, `/super-admin/statistics` |
| [clinic-admin.md](clinic-admin.md) | `/clinics/{id}`, `/specializations`, `/me/clinic` |
| [questionnaire-public.md](questionnaire-public.md) | `/public/*` анкета пациента |
| [clinic-questionnaires.md](clinic-questionnaires.md) | `/clinics/{id}/questionnaires` персональные ссылки и регистратура |
| [questionnaires.md](questionnaires.md) | `/questionnaires` раздел врача |
| [protocols.md](protocols.md) | `/protocols` |
| [protocol-templates.md](protocol-templates.md) | `/protocol-templates` |
| [protocol-structures.md](protocol-structures.md) | `/protocol-structures`, `/protocol-fields-main` |
| [template-groups.md](template-groups.md) | `/template-groups` |
| [dictionaries.md](dictionaries.md) | `/dictionary`, `/ref`, `/mkb10` |
| [clinrec.md](clinrec.md) | `/clinrec/guidelines` каталог КР, resolve, index |
| [check-dms.md](check-dms.md) | `POST /check_dms` — ДМС-проверка назначений |
| [ml.md](ml.md) | ML proxy и dict-autocomplete |

Системный: `GET /health` — без auth, `{ status: "ok" }`.
