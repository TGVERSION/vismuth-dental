# API

Интерактивная спецификация: **http://localhost:8000/docs** (Swagger) или `/redoc`.

Ниже — обзор групп. Точные тела запросов/ответов смотрите в OpenAPI, не в этом файле.

## Auth

Префикс `/auth` ([`routers/auth.py`](../app/routers/auth.py)):

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/register` | Заявка: email + пароль → код на почту |
| POST | `/auth/register/confirm` | Подтверждение кода → JWT + пользователь |
| POST | `/auth/login` | Логин → JWT |
| POST | `/auth/logout` | Logout (клиентский контракт) |

Большинство остальных endpoint'ов требуют заголовок:

```http
Authorization: Bearer <access_token>
```

Проверка: [`deps.get_current_user`](../app/deps.py) (JWT → `service_user`, активный и не soft-deleted). Роль читается из `service_user_role` → `role`; в ответах пользователя: `role` (код) и `role_name_ru` (кириллица).

Privileged-доступ (`super_admin` или `admin`): CRUD `service_user`, чужие `user-settings`, создание/правка общих (`privacy: general`) protocol templates — dependency [`require_privileged`](../app/deps.py).

## Системные

| Метод | Путь | Auth |
|-------|------|------|
| GET | `/health` | нет |

## Пользователи и настройки

| Группа | Пути (кратко) |
|--------|----------------|
| service_user | `GET /service_user` (me), CRUD `/service_user/{id}`, список id |
| roles | `GET /roles` — справочник ролей (`name`, `name_ru`) |
| user-settings | `/user-settings` — GET/POST/PUT/PATCH настроек помощников |

## Протоколы и шаблоны

| Группа | Префикс |
|--------|---------|
| protocol-structures | `/protocol-structures` |
| protocol-fields-main | `/protocol-fields-main` (справочник ключевых полей) |
| protocols | `/protocols` |
| protocol-templates | `/protocol-templates` |
| template-groups | `/template-groups` |

## Справочники

| Путь | Описание |
|------|----------|
| `GET /dictionary` | Реестр OID → имя таблицы `ref_*` |
| `GET /ref/{name}` | Поиск по whitelist-таблице (`dictionaries_config`) |
| `GET /mkb10` | Отдельный поиск по МКБ-10 |

Допустимые `{name}` для `/ref/...` заданы в [`dictionaries_config.py`](../app/dictionaries_config.py).

## ML (proxy и dict-autocomplete)

| Путь | Назначение |
|------|------------|
| `POST /ml_autocomplete` | Proxy → ml-service (или dict-режим по настройкам) |
| `POST /ml_mkb_code` | Proxy подбора кода МКБ |
| `POST /ml_fullness/...` | Proxy проверки полноты |
| `POST /ml_clinrec_check` | Proxy проверки клинических рекомендаций |
| `POST /autocomplete_dict/complete_dict` | Автодополнение по `ml_unigrams`/`ml_bigrams` в Postgres |

Подробнее про proxy и логирование: [ml-and-worker.md](ml-and-worker.md).

## Регистрация роутеров

Все роутеры подключаются в [`app/main.py`](../app/main.py). Новый router нужно туда добавить явно.
