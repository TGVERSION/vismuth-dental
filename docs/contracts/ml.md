# ML proxy & dict-autocomplete

Поведение HTTP для UI. Internals (Redis stream, worker, логи): [`../../backend/docs/ml-and-worker.md`](../../backend/docs/ml-and-worker.md).

Код: `ml_autocomplete.py`, `ml_mkb_code.py`, `ml_fullness.py`, `ml_clinrec_check.py`, `ml_autocomplete_dict.py`.

Почти всё: **JWT**, без role-checks. Исключение: `POST /autocomplete_dict/complete_dict` — **без auth**.

**Подписка:** у пользователя с active `clinic_membership` при `access_status=expired` ML-ручки ниже отвечают `503` + `detail.code=subscription_expired` (до вызова ml-service). Без membership (супер-админ, старые пользователи) — без блокировки. Dict-режим, stats/select и `/autocomplete_dict` токены не тратят — проверку не делают.

## POST /ml_autocomplete

- **Auth:** JWT
- **Назначение:** автодополнение текста поля
- **Поведение:** при `type=ml_autocomplete` → проверка подписки → ML `/autocomplete/complete` (`field_name` обязателен, иначе `422`); иначе dict `autocomplete_mixed` (без проверки подписки). Событие в Redis `autocomplete_shown`
- **Frontend:** подсказки при вводе в протоколе
- **Код:** `proxy_ml_autocomplete`

## POST /ml_autocomplete_stats

- **Auth:** JWT
- **Назначение:** зафиксировать выбор suggestion / stats
- **Поведение:** Redis event (подписку не проверяет)
- **Код:** `push_selected_event`

## POST /ml_mkb_code

- **Auth:** JWT
- **Назначение:** подбор кода МКБ через ML
- **Поведение:** проверка подписки; proxy ML `/mkb_code`; лог; Redis `autocomplete_shown`
- **Код:** `proxy_mkb_code`

## POST /ml_mkb_code/select

- **Auth:** JWT
- **Назначение:** событие выбора кода (скрыт из OpenAPI)
- **Поведение:** только Redis event (подписку не проверяет)
- **Код:** `push_selected_event`

## POST /ml_fullness_complaints

- **Auth:** JWT
- **Назначение:** проверка полноты жалоб
- **Поведение:** проверка подписки; proxy ML `/fullness/complaints`; Redis event со status/color/analysis/suggested_text
- **Frontend:** индикатор полноты поля
- **Код:** `proxy_ml_fullness_complaints`

## POST /ml_clinrec_check

- **Auth:** JWT
- **Назначение:** проверка клинических рекомендаций
- **Поведение:**
  - проверка подписки;
  - request: `protocol_text` + опционально `mkb` / `guideline_code` / `main_diagnosis`;
  - без `mkb`/`guideline_code`/`main_diagnosis` — в ML legacy `{ protocol_text }` (как раньше);
  - с `guideline_code` — строка должна быть `active`, иначе `422`, ML не вызывается;
  - с `mkb` или `main_diagnosis` — resolve как `GET /clinrec/guidelines/resolve`; нет active → `422`;
  - **сейчас** в ML всегда уходит только `{ protocol_text }` (текущий ml-service);
  - целевой body с `guideline` + presigned GET уже собран в `services/clinrec_ml.py` (`use_guideline_source=True` — когда ML будет готов);
  - в ответ добавляются `guideline_code` / `guideline_title`, если guideline найден;
  - без Redis
- **Frontend:** UI может слать `mkb` + `protocol_text`; без mkb — как раньше
- **Код:** `proxy_ml_clinrec_check`

Каталог: [clinrec.md](clinrec.md).

## POST /autocomplete_dict/complete_dict

- **Auth:** none
- **Назначение:** автодополнение по `ml_unigrams` / `ml_bigrams` в Postgres
- **Поведение:** SQL funcs `search_by_prefix` / `predict_by_prefix`; `{ suggestions: [...] }`; `500` на ошибке
- **Frontend:** dict-режим (также вызывается изнутри `/ml_autocomplete`)
- **Код:** `autocomplete_endpoint`

## Использование /collect_form из анкеты

Публичный flow пациента (`questionnaire-public.md`) вызывает ml-service `POST /collect_form` через `proxy_post_to_ml` **без** отдельного backend proxy-endpoint для врача.  
Тело: `messages` + опциональный `state` с прошлого шага. Ответ: `status`, `messages` (вопрос или null), `state` (сохраняется в `questionnaire.collect_form_state`).  
Лимиты вопросов и fallback `ai_unavailable` — на стороне backend; публичный API для UI не меняется.
