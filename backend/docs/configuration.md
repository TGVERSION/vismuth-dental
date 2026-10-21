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
| `QUESTIONNAIRE_AI_TIMEOUT` | `20` | Timeout `/collect_form` и `/summarize_form` (сек) |
| `QUESTIONNAIRE_ANSWER_MAX_LEN` | `1000` | Обрезка ответа |
| `QUESTIONNAIRE_AI_PRIMARY_MAX` | `6` | Лимит уточняющих на backend (первичный); у ml-service свой бюджет вопросов |
| `QUESTIONNAIRE_AI_REPEAT_MAX` | `2` | Лимит уточняющих на backend (повторный) |
| `QUESTIONNAIRE_DEVICE_LIMIT_PER_HOUR` | `5` | С устройства |
| `QUESTIONNAIRE_IP_LIMIT_PER_HOUR` | `30` | С IP |
| `QUESTIONNAIRE_CLINIC_DAILY_PER_DOCTOR` | `30` | Суточный лимит × активные врачи |
| `QUESTIONNAIRE_CLINIC_DAILY_MIN` | `100` | Минимум суточного лимита клиники |
| `QUESTIONNAIRE_ABANDON_HOURS` | `24` | Брошенная анкета |
| `QUESTIONNAIRE_RETENTION_DAYS` | `45` | Удаление completed |
| `QUESTIONNAIRE_CODE_WINDOW_DAYS` | `30` | Уникальность кода |
| `QUESTIONNAIRE_APPOINTMENT_DAYS_AHEAD` | `30` | Календарь записи |
| `TRUST_PROXY` | `false` | Брать IP из `X-Forwarded-For` |

## S3 / MinIO (PDF клинреков)

Локально — S3-совместимый **Silo** (форк MinIO) в compose: сервисы `minio`, `minio-init`. Образ `pgsty/silo` с pinned digest: `quay.io/minio/*` больше не отдаётся анонимно. Env и API совместимы с MinIO (`MINIO_ROOT_*`, `/minio/health/live`, `mc`). Бакет приватный: `vismuth-clinrec`. Ключи объектов: `guidelines/{source_id}/{version}/source.pdf` (см. [clinrec-architecture.md](../../../clinrec-architecture.md)).

Читаются в [`app/config.py`](../app/config.py); клиент — [`app/services/s3.py`](../app/services/s3.py) (boto3).

| Переменная | Default | Описание |
|------------|---------|----------|
| `S3_ENDPOINT_URL` | `http://minio:9000` | Endpoint для SDK (`head_object` с backend) |
| `S3_PRESIGN_ENDPOINT_URL` | `http://minio:9000` | Host внутри presigned URL (SigV4); ML в той же сети — как `S3_ENDPOINT_URL` |
| `S3_ACCESS_KEY` | — | Access key (= `MINIO_ROOT_USER` в compose) |
| `S3_SECRET_KEY` | — | Secret key (= `MINIO_ROOT_PASSWORD` в compose) |
| `S3_BUCKET` | `vismuth-clinrec` | Имя бакета (пишется в `clinrec_guideline.s3_bucket`) |
| `S3_REGION` | `us-east-1` | Обязателен для boto3; MinIO значение не использует |
| `S3_ADDRESSING_STYLE` | `path` | `path` для MinIO; в облаке при необходимости `virtual` |
| `S3_PRESIGN_TTL_SECONDS` | `900` | TTL presigned GET для ML |
| `CLINREC_INDEX_TIMEOUT` | `600` | Timeout HTTP backend→ML на `POST /clinrec/index` (сек) |
| `MINIO_API_PORT` | `9000` | Publish API на хост |
| `MINIO_CONSOLE_PORT` | `9001` | Publish консоли на хост |

Переезд в облачный S3: те же бакет и ключи объектов; меняются endpoint’ы, ключи доступа и при необходимости `S3_ADDRESSING_STYLE`.

## Локальный запуск vs docker

| Контекст | `POSTGRES_HOST` | `ML_SERVICE_URL` | `S3_ENDPOINT_URL` / `S3_PRESIGN_ENDPOINT_URL` |
|----------|-----------------|------------------|-----------------------------------------------|
| Контейнеры compose | `db` | `http://ml-service:8000` | `http://minio:9000` |
| Процессы на хосте | `localhost` | `http://localhost:8001` (порт publish ml-service) | `http://localhost:9000` (и оба URL, если presign для процесса на хосте) |

`API_MAIN_URL` / `API_ML_URL` в `.env` относятся к **frontend** (Next.js rewrites), backend их не читает.
