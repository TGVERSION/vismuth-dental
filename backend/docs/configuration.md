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
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | TTL access JWT |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | TTL opaque refresh (БД + cookie) |
| `REFRESH_COOKIE_NAME` | `refresh_token` | Имя httpOnly cookie |
| `REFRESH_COOKIE_PATH` | `/` | Path cookie (Next rewrite `/api/main` и прямой `:8000`) |
| `REFRESH_COOKIE_SECURE` | `false` | `true` на HTTPS в проде |
| `REFRESH_COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none` |
| `DEFAULT_USER_ROLE` | `doctor` | Роль при регистрации (`super_admin` \| `admin` \| `doctor` \| `patient`) |

## Регистрация / SMTP

| Переменная | Default | Описание |
|------------|---------|----------|
| `SMTP_HOST` | `""` | SMTP-сервер |
| `SMTP_PORT` | `465` | Порт |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | `""` | Учётные данные отправителя |
| `REGISTRATION_CODE_EXPIRE_MINUTES` | `15` | TTL кода из письма |
| `REGISTRATION_CODE_MAX_ATTEMPTS` | `5` | Лимит попыток ввода кода |
| `FRONTEND_PUBLIC_URL` | `http://localhost:3000` | База ссылок invite и публичных анкет (`/invite/accept?token=…`, `/q/{slug}`) |
| `INVITE_EXPIRE_DAYS` | `7` | TTL приглашения в клинику |

Без рабочего SMTP регистрация не сможет отправить код.  
Invite создаётся даже при сбое SMTP: в ответе `invite_url` + `email_sent: false`.

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

## Анкета пациента

| Переменная | Default | Описание |
|------------|---------|----------|
| `QUESTIONNAIRE_AI_TIMEOUT` | `20` | Timeout вызова `/collect_form` (сек) |
| `QUESTIONNAIRE_ANSWER_MAX_LEN` | `1000` | Обрезка ответа |
| `QUESTIONNAIRE_AI_PRIMARY_MAX` | `6` | Лимит уточняющих (первичный) |
| `QUESTIONNAIRE_AI_REPEAT_MAX` | `2` | Лимит уточняющих (повторный) |
| `QUESTIONNAIRE_DEVICE_LIMIT_PER_HOUR` | `5` | С устройства |
| `QUESTIONNAIRE_IP_LIMIT_PER_HOUR` | `30` | С IP |
| `QUESTIONNAIRE_CLINIC_DAILY_PER_DOCTOR` | `30` | Суточный лимит × активные врачи |
| `QUESTIONNAIRE_CLINIC_DAILY_MIN` | `100` | Минимум суточного лимита клиники |
| `QUESTIONNAIRE_ABANDON_HOURS` | `24` | Брошенная анкета |
| `QUESTIONNAIRE_RETENTION_DAYS` | `45` | Удаление completed |
| `QUESTIONNAIRE_CODE_WINDOW_DAYS` | `30` | Уникальность кода |
| `QUESTIONNAIRE_APPOINTMENT_DAYS_AHEAD` | `30` | Календарь записи |
| `TRUST_PROXY` | `false` | Брать IP из `X-Forwarded-For` |

## Локальный запуск vs docker

| Контекст | `POSTGRES_HOST` | `ML_SERVICE_URL` |
|----------|-----------------|------------------|
| Контейнеры compose | `db` | `http://ml-service:8000` |
| Процессы на хосте | `localhost` | `http://localhost:8001` (порт publish ml-service) |

`API_MAIN_URL` / `API_ML_URL` в `.env` относятся к **frontend** (Next.js rewrites), backend их не читает.
