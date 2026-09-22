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
| **none** | Публичный (register/login, часть dict-autocomplete) |
| **JWT** | Валидный токен → активный, не soft-deleted `service_user` |
| **privileged** | JWT + роль `super_admin` или `admin` |

Ошибки auth (типично): `401` не аутентифицирован / битый токен / user не найден / удалён; `403` inactive или нет прав.

Logout **не** инвалидирует JWT на сервере — клиент просто забывает токен.

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

## Группы контрактов

| Файл | Группа |
|------|--------|
| [auth.md](auth.md) | `/auth` |
| [roles.md](roles.md) | `/roles` |
| [service-user.md](service-user.md) | `/service_user*` |
| [user-settings.md](user-settings.md) | `/user-settings` |
| [protocols.md](protocols.md) | `/protocols` |
| [protocol-templates.md](protocol-templates.md) | `/protocol-templates` |
| [protocol-structures.md](protocol-structures.md) | `/protocol-structures`, `/protocol-fields-main` |
| [template-groups.md](template-groups.md) | `/template-groups` |
| [dictionaries.md](dictionaries.md) | `/dictionary`, `/ref`, `/mkb10` |
| [ml.md](ml.md) | ML proxy и dict-autocomplete |

Системный: `GET /health` — без auth, `{ status: "ok" }`.
