# ML proxy & dict-autocomplete

Поведение HTTP для UI. Internals (Redis stream, worker, логи): [`../../backend/docs/ml-and-worker.md`](../../backend/docs/ml-and-worker.md).

Код: `ml_autocomplete.py`, `ml_mkb_code.py`, `ml_fullness.py`, `ml_clinrec_check.py`, `ml_autocomplete_dict.py`.

Почти всё: **JWT**, без role-checks. Исключение: `POST /autocomplete_dict/complete_dict` — **без auth**.

## POST /ml_autocomplete

- **Auth:** JWT
- **Назначение:** автодополнение текста поля
- **Поведение:** при `type=ml_autocomplete` → ML `/autocomplete/complete` (`field_name` обязателен, иначе `422`); иначе dict `autocomplete_mixed`. Событие в Redis `autocomplete_shown`
- **Frontend:** подсказки при вводе в протоколе
- **Код:** `proxy_ml_autocomplete`

## POST /ml_autocomplete_stats

- **Auth:** JWT
- **Назначение:** зафиксировать выбор suggestion / stats
- **Поведение:** Redis event
- **Код:** `push_selected_event`

## POST /ml_mkb_code

- **Auth:** JWT
- **Назначение:** подбор кода МКБ через ML
- **Поведение:** proxy ML `/mkb_code`; лог; Redis `autocomplete_shown`
- **Код:** `proxy_mkb_code`

## POST /ml_mkb_code/select

- **Auth:** JWT
- **Назначение:** событие выбора кода (скрыт из OpenAPI)
- **Поведение:** только Redis event
- **Код:** `push_selected_event`

## POST /ml_fullness_complaints

- **Auth:** JWT
- **Назначение:** проверка полноты жалоб
- **Поведение:** proxy ML `/fullness/complaints`; Redis event со status/color/analysis/suggested_text
- **Frontend:** индикатор полноты поля
- **Код:** `proxy_ml_fullness_complaints`

## POST /ml_clinrec_check

- **Auth:** JWT
- **Назначение:** проверка клинических рекомендаций
- **Поведение:** proxy ML `/clinrec_checking/check` с `protocol_text`; без Redis
- **Код:** `proxy_ml_clinrec_check`

## POST /autocomplete_dict/complete_dict

- **Auth:** none
- **Назначение:** автодополнение по `ml_unigrams` / `ml_bigrams` в Postgres
- **Поведение:** SQL funcs `search_by_prefix` / `predict_by_prefix`; `{ suggestions: [...] }`; `500` на ошибке
- **Frontend:** dict-режим (также вызывается изнутри `/ml_autocomplete`)
- **Код:** `autocomplete_endpoint`

## Использование /collect_form из анкеты

Публичный flow пациента (`questionnaire-public.md`) вызывает ml-service `POST /collect_form` через `proxy_post_to_ml` **без** отдельного backend proxy-endpoint для врача.  
Лимиты и fallback — на стороне backend; контракт ML не менялся.
