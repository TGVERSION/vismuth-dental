# API

Интерактивная спецификация: **http://localhost:8000/docs** (Swagger) или `/redoc`.

**Поведение для frontend / AI-агентов:** [`../../docs/contracts/`](../../docs/contracts/) (старт с [overview.md](../../docs/contracts/overview.md)).  
Точные тела запросов/ответов — в OpenAPI, не дублируются здесь.

## Auth

Префикс `/auth` ([`routers/auth.py`](../app/routers/auth.py)) — контракт: [auth.md](../../docs/contracts/auth.md).  
Гайд для frontend (cookie + interceptor): [auth-refresh.md](../../docs/frontend/auth-refresh.md).

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/register` | Заявка: email + пароль → код на почту |
| POST | `/auth/register/confirm` | Подтверждение кода → access JWT + refresh cookie |
| POST | `/auth/login` | Логин → access JWT + refresh cookie |
| POST | `/auth/refresh` | Ротация refresh cookie → новый access |
| POST | `/auth/logout` | Revoke refresh + clear cookie (Bearer не обязателен) |

Большинство остальных endpoint'ов требуют заголовок:

```http
Authorization: Bearer <access_token>
```

Refresh **не** передаётся в JSON/header — только httpOnly cookie (`REFRESH_COOKIE_NAME`, default `refresh_token`).

Проверка access: [`deps.get_current_user`](../app/deps.py). Роль: `service_user_role` → `role`; в ответах `role` + `role_name_ru`.  
Privileged (`super_admin` \| `admin`): [`require_privileged`](../app/deps.py).  
Только `super_admin`: [`require_roles("super_admin")`](../app/deps.py) на `/super-admin/*`.  
Подробнее: [roles-and-permissions.md](../../docs/domains/roles-and-permissions.md).

## Системные

| Метод | Путь | Auth |
|-------|------|------|
| GET | `/health` | нет |

## Пользователи и настройки

| Группа | Контракт | Пути (кратко) |
|--------|----------|----------------|
| service_user | [service-user.md](../../docs/contracts/service-user.md) | me, CRUD, список id |
| roles | [roles.md](../../docs/contracts/roles.md) | `GET /roles` |
| user-settings | [user-settings.md](../../docs/contracts/user-settings.md) | `/user-settings` |

## Super-admin (клиники)

Контракт: [super-admin-clinics.md](../../docs/contracts/super-admin-clinics.md).  
Префикс `/super-admin/clinics` — только роль `super_admin`. Invite accept/preview — в [auth.md](../../docs/contracts/auth.md).

Статистика анкет (все клиники + summary): [questionnaire-statistics.md](../../docs/contracts/questionnaire-statistics.md) — `GET /super-admin/statistics`.

## Админка клиники и анкеты

| Группа | Контракт | Префикс |
|--------|----------|---------|
| clinic-admin | [clinic-admin.md](../../docs/contracts/clinic-admin.md) | `/clinics/{id}`, `/specializations`, `/me/clinic`, `/clinics/{id}/statistics` |
| questionnaire-statistics | [questionnaire-statistics.md](../../docs/contracts/questionnaire-statistics.md) | см. выше + `/super-admin/statistics` |
| questionnaire-public | [questionnaire-public.md](../../docs/contracts/questionnaire-public.md) | `/public` |
| questionnaires | [questionnaires.md](../../docs/contracts/questionnaires.md) | `/questionnaires` |

## Протоколы и шаблоны

| Группа | Контракт | Префикс |
|--------|----------|---------|
| protocol-structures | [protocol-structures.md](../../docs/contracts/protocol-structures.md) | `/protocol-structures`, `/protocol-fields-main` |
| protocols | [protocols.md](../../docs/contracts/protocols.md) | `/protocols` |
| protocol-templates | [protocol-templates.md](../../docs/contracts/protocol-templates.md) | `/protocol-templates` |
| template-groups | [template-groups.md](../../docs/contracts/template-groups.md) | `/template-groups` |

## Справочники

Контракт: [dictionaries.md](../../docs/contracts/dictionaries.md).

| Путь | Описание |
|------|----------|
| `GET /dictionary` | Реестр OID → имя таблицы `ref_*` |
| `GET /ref/{name}` | Поиск по whitelist-таблице |
| `GET /mkb10` | Поиск по МКБ-10 |

Whitelist: [`dictionaries_config.py`](../app/dictionaries_config.py).

## ML (proxy и dict-autocomplete)

Контракт: [ml.md](../../docs/contracts/ml.md). Internals: [ml-and-worker.md](ml-and-worker.md).

| Путь | Назначение |
|------|------------|
| `POST /ml_autocomplete` | Proxy → ml-service (или dict-режим); ML-режим при истёкшей подписке — `503 subscription_expired` |
| `POST /ml_mkb_code` | Proxy подбора кода МКБ; при истёкшей подписке — `503 subscription_expired` |
| `POST /ml_fullness_complaints` | Proxy проверки полноты; при истёкшей подписке — `503 subscription_expired` |
| `POST /ml_clinrec_check` | Proxy клинических рекомендаций; при истёкшей подписке — `503 subscription_expired` |
| `POST /autocomplete_dict/complete_dict` | Dict-autocomplete в Postgres |

## Регистрация роутеров

Все роутеры — [`app/main.py`](../app/main.py). Новый router — `include_router` + файл в `docs/contracts/`.
