# Конфигурация

Источник правды для runtime: корневой файл [`vismuth/.env`](../../.env) (подключается через `env_file` в compose). Чтение в коде — [`app/config.py`](../app/config.py) (`Settings`).

## Postgres

| Переменная | Default | Описание |
|------------|---------|----------|
| `POSTGRES_DB` | `vismuth` | Имя БД |
| `POSTGRES_USER` | `vismuth` | Пользователь |
| `POSTGRES_PASSWORD` | `vismuth_password` | Пароль |
| `POSTGRES_HOST` | `db` | Хост (в compose — имя сервиса `db`) |
| `POSTGRES_PORT` | `5432` | Порт |

URL собираются так:

- async (приложение): `postgresql+asyncpg://...`
- sync (Alembic, seed): `postgresql://...`

## Auth / JWT

| Переменная | Default | Описание |
|------------|---------|----------|
| `JWT_SECRET` | `dev-only-change-me-in-production` | Секрет подписи (сменить в проде) |
| `JWT_ALGORITHM` | `HS256` | Алгоритм |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | TTL access token |
| `DEFAULT_USER_ROLE` | `doctor` | Роль при регистрации |

## Регистрация / SMTP

| Переменная | Default | Описание |
|------------|---------|----------|
| `SMTP_HOST` | `""` | SMTP-сервер |
| `SMTP_PORT` | `465` | Порт |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | `""` | Учётные данные отправителя |
| `REGISTRATION_CODE_EXPIRE_MINUTES` | `15` | TTL кода из письма |
| `REGISTRATION_CODE_MAX_ATTEMPTS` | `5` | Лимит попыток ввода кода |

Без рабочего SMTP регистрация не сможет отправить код.

## ML

| Переменная | Default | Описание |
|------------|---------|----------|
| `ML_SERVICE_URL` | `http://ml-service:8000` | Базовый URL ml-service |

## Redis / worker

| Переменная | Default | Описание |
|------------|---------|----------|
| `REDIS_HOST` | `redis` | Хост |
| `REDIS_PORT` | `6379` | Порт |
| `REDIS_DB` | `0` | Номер DB |
| `REDIS_URL` | `redis://redis:6379/0` | Полный URL |
| `REDIS_STREAM_KEY` | `ml_mkb_code:events` | Ключ stream |
| `REDIS_CONSUMER_GROUP` | `ml_mkb_code_group` | Consumer group |
| `REDIS_CONSUMER_NAME` | `backend-worker-1` | Имя consumer |

## Локальный запуск vs docker

| Контекст | `POSTGRES_HOST` | `ML_SERVICE_URL` |
|----------|-----------------|------------------|
| Контейнеры compose | `db` | `http://ml-service:8000` |
| Процессы на хосте | `localhost` | `http://localhost:8001` (порт publish ml-service) |

`API_MAIN_URL` / `API_ML_URL` в `.env` относятся к **frontend** (Next.js rewrites), backend их не читает.
