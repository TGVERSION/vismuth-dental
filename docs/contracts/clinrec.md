# Клинические рекомендации (каталог)

Каталог PDF клинреков в Postgres + resolve по МКБ. Credentials S3 только у backend; RAG / index — зона ml-service (эндпоинты ещё в работе).

Код: `backend/app/routers/clinrec_guidelines.py`, модели `clinrec_guideline` / `clinrec_guideline_mkb`, контракт ML-вызовов — `backend/app/services/clinrec_ml.py`.

Проверка протокола: [ml.md](ml.md) → `POST /ml_clinrec_check`.

## Auth

| Операции | Auth |
|----------|------|
| GET list / get / resolve | JWT |
| POST / PATCH / DELETE / index | `super_admin` |

Врач в list/get видит только `status=active`. Фильтр `?status=` с другим значением — `403`.

## POST /clinrec/guidelines

- **Auth:** super_admin
- **Назначение:** создать запись каталога на уже загруженный PDF в S3
- **Поведение:** `s3_bucket` из Settings; `s3_key` обязан быть `guidelines/{source_id}/{version}/source.pdf`; статус `uploaded`; конфликты `code` / `source_id` / `mkb_prefix` → `409` + `detail.code`
- **Ответ:** guideline + `mkb_prefixes[]`
- **Код:** `create_guideline`

## GET /clinrec/guidelines

- **Auth:** JWT
- **Назначение:** список для UI / админки
- **Поведение:** врач — только `active`; super_admin — все или `?status=`
- **Код:** `list_guidelines`

## GET /clinrec/guidelines/resolve

- **Auth:** JWT
- **Назначение:** выбрать active guideline по диагнозу
- **Поведение:** query `mkb=` или `diagnosis=` (ведущий токен МКБ из строки); среди префиксов побеждает самый длинный, который является префиксом кода; нет совпадения → `404 guideline_not_found`
- **Frontend:** после выбора основного диагноза перед check
- **Код:** `resolve_guideline`

## GET /clinrec/guidelines/{id}

- **Auth:** JWT
- **Поведение:** врач — только `active`, иначе `404`
- **Код:** `get_guideline`

## PATCH /clinrec/guidelines/{id}

- **Auth:** super_admin
- **Поведение:** частичное обновление; `mkb_prefixes` при передаче заменяют набор целиком; смена `version` / `s3_key` / `source_id` у `active` → статус `uploaded` (нужен повторный index)
- **Код:** `patch_guideline`

## DELETE /clinrec/guidelines/{id}

- **Auth:** super_admin
- **Поведение:** удаляет строку и префиксы; PDF в S3 не трогает; best-effort вызов будущего `DELETE {ML}/clinrec/index/{code}` (пока эндпоинта нет — no-op)
- **Код:** `delete_guideline`

## POST /clinrec/guidelines/{id}/index

- **Auth:** super_admin
- **Назначение:** оркестрация индексации PDF в ML (синхронно)
- **Поведение:** статусы `uploaded`\|`failed`\|`active`; S3 `head_object` + presigned GET → `POST {ML}/clinrec/index`; успех → `active`; ошибка → `failed` + `index_error`. **Пока ml-service не реализует `/clinrec/index` — будет 502.** Контракт тела готов в `clinrec_ml.build_index_payload`.
- **Ответ:** `{ id, code, status, version, chunks?, index_error? }`
- **Код:** `index_guideline`
