# PL-310 — Endpoint ДМС: сверка с клиническими рекомендациями

Handoff после подготовки локального S3 и загрузчика PDF.  
В новом диалоге: спланировать и реализовать backend-endpoint для согласования услуг по ДМС.

## Цель задачи

Добавить endpoint, который для согласования услуг по ДМС сверяет назначения/заключение врача с клиническими рекомендациями Минздрава и помогает корректно оформить заключение (в идеале — со ссылками на КР).

Договорённость в обсуждении: **ДМС-проверка и проверка по клиническим рекомендациям — один продуктовый контур** (общая база КР / один pipeline сверки).

## Что уже есть в проекте

### 1. Текущая проверка клинреков (legacy, один диагноз)

End-to-end проверка протокола уже есть, но завязана на одну базу знаний:

| Слой | Что |
|------|-----|
| Frontend | Кнопка «Проверить по клин. реком.» если заполнен основной диагноз; в ML уходит только `protocol_text` |
| Backend | `POST /ml_clinrec_check` — proxy + проверка подписки |
| ML | `POST /clinrec_checking/check` — RAG (Chroma) + GigaChat |

- Контракт: `{ protocol_text }` → findings (`critical` / `warning` / `info`).
- Chroma `clinic_recommendations` (`ml-service/chroma_qwen_md_3`) — ~27 чанков **только по АГ**.
- Retrieval **не смотрит на диагноз**; запросы захардкожены.
- Код: `backend/app/routers/ml_clinrec_check.py`, `ml-service/.../clinrec_checking.py`, UI в `frontend/src/app/(app)/page.tsx`.
- Архитектурный черновик: `clinrec-architecture.md` (корень репозитория PP).

### 2. Локальный S3 (Silo)

- Compose: сервисы `minio` + `minio-init` (образ `pgsty/silo` — S3/MinIO-совместимый; `quay.io/minio/*` анонимно недоступен).
- Бакет: `vismuth-clinrec` (приватный).
- Env-контракт: `S3_*` в `.env` / `.env.template`, docs в `backend/docs/configuration.md`, `architecture.md`.
- S3-клиент: `app/config.py` (`S3_*`) + `app/services/s3.py` (presign / head).

### 3. Загрузчик PDF с Минздрава

- Путь: `vismuth/scripts/clinrec/` (`run_download.sh` → `download_to_s3.py`).
- Источник PDF: `https://apicr.minzdrav.gov.ru/api.ashx?op=GetClinrecPdf&id={source_id}_{revision}`.
- Каталог строится перебором id (официального list-all API нет).
- Идемпотентность: `head_object` + сравнение размера → `skip`.
- Запуск: `./scripts/clinrec/run_download.sh` (нужны поднятые `minio` / `minio-init`).

## Как хранятся PDF в S3 (важно для PL-310)

```text
guidelines/{source_id}/{revision}/source.pdf
```

Пример: `guidelines/157/5/source.pdf`

- `source_id` — **числовой ID КР в рубрикаторе Минздрава**, не код диагноза/МКБ.
- `revision` — номер редакции (`157_5` → `5`).

**По диагнозу из одного только S3 искать нельзя** — в ключе нет МКБ.

Связь «диагноз / МКБ → PDF» должна жить в **каталоге Postgres** (ещё не реализован):

```text
диагноз / МКБ  →  clinrec_guideline (+ mkb mapping)
               →  s3_key = guidelines/{source_id}/{revision}/source.pdf
               →  backend выдаёт presigned GET
               →  ML скачивает PDF / использует индекс
```

Presigned URL: credentials S3 только у backend; ML получает короткий GET (`S3_PRESIGN_*`).

## Что нужно спроектировать в PL-310

1. **Модель каталога в Postgres**
   - guideline: `code` / `source_id`, title, status, version, `s3_key` (или bucket+key).
   - маппинг МКБ → guideline (префиксы или M2M).
   - «текущая» версия — указатель в БД, не `latest.pdf` в бакете.

2. **Resolve по диагнозу**
   - например `GET /clinrec/guidelines/resolve?mkb=…` или по тексту основного диагноза.
   - вход endpoint ДМС: код/строка диагноза + текст заключений/назначений (уточнить контракт).

3. **Endpoint ДМС / сверки**
   - не слать PDF в теле запроса — передавать `guideline` + `source: { type: "s3", url: "<presigned>" }` (или `guideline_id` если ML уже проиндексировал).
   - ответ: findings / рекомендации для согласования услуг, желательно с цитатами из КР (`guideline_ref`, `guideline_quote` уже есть в legacy-схеме).

4. **Индексация (смежный долг)**
   - сейчас RAG только по АГ; для многих КР нужен index по `guideline_id` + фильтр в Chroma (см. `clinrec-architecture.md`).
   - решить: синхронный check по PDF на каждый запрос vs async index заранее.

5. **Расширение / замена** `POST /ml_clinrec_check`
   - backward-compatible с текущим фронтом, либо отдельный ДМС-маршрут.

## Вне scope на момент handoff (уже сделано / не трогать в PL-310 без нужды)

- Подъём локального S3 и схема ключей.
- Скрипт массовой загрузки PDF.
- Парсинг/индексация всех PDF в Chroma (отдельный шаг, но может понадобиться для endpoint).

## Полезные пути

| Что | Путь |
|-----|------|
| Архитектура клинреков | `clinrec-architecture.md` (корень PP) |
| Загрузчик | `vismuth/scripts/clinrec/README.md` |
| Compose MinIO/Silo | `vismuth/docker-compose.yml` |
| Legacy proxy | `vismuth/backend/app/routers/ml_clinrec_check.py` |
| ML check | `vismuth/ml-service/app/services/clinrec_checking.py` |
| Контракт ML | `vismuth/docs/contracts/ml.md` |

## Стартовый фокус нового диалога

1. Контракт request/response endpoint ДМС.
2. Схема таблиц: guideline + МКБ → `s3_key`.
3. Как resolve диагноза выбирает PDF и что уходит в ML (presigned vs уже проиндексированный `guideline_id`).
4. Минимальный vertical slice: один диагноз (не только АГ) end-to-end.
