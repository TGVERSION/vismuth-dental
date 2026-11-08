# ML proxy и worker

## HTTP proxy

Сервис [`app/services/ml_proxy.py`](../app/services/ml_proxy.py) ходит в upstream `ML_SERVICE_URL` (по умолчанию `http://ml-service:8000`).

Роутеры backend (`ml_autocomplete`, `ml_mkb_code`, `ml_fullness`, `ml_clinrec_check`):

1. проверяют JWT / пользователя;
2. при active membership и `expired` клинике отвечают `503` + `subscription_expired` (до upstream); без membership — без блокировки; dict-ветка `/ml_autocomplete` проверку не делает;
3. проксируют тело запроса в ml-service;
4. при наличии контекста публикуют событие лога ответа в Redis Stream.

Ошибки upstream превращаются в HTTP-ошибки FastAPI с `detail` от ml-service, если он есть.

### Clinrec / DMS

Каталог: [`routers/clinrec_guidelines.py`](../app/routers/clinrec_guidelines.py) + [`services/s3.py`](../app/services/s3.py).  
Контракт ML: [`services/clinrec_ml.py`](../app/services/clinrec_ml.py).

- `POST /clinrec/guidelines/{id}/index` (super_admin): `head_object` → presigned → `POST {ML}/clinrec/index` (`CLINREC_INDEX_TIMEOUT`). Пока пути на ML нет — 502 / статус `failed`.
- `DELETE /clinrec/guidelines/{id}`: best-effort `DELETE {ML}/clinrec/index/{code}` (пока no-op при ошибке).
- `POST /ml_clinrec_check`: resolve опционален; в ML legacy `{ protocol_text }`.
- `POST /check_dms`: resolve (`uploaded`\|`active`\|`failed`) → `get_object` PDF → multipart `POST {ML}/check_dms` (`file`, `mkb`, `appointments`), timeout `CLINREC_DMS_TIMEOUT`.

## Redis Stream

Настройки: `REDIS_URL`, `REDIS_STREAM_KEY`, `REDIS_CONSUMER_GROUP`, `REDIS_CONSUMER_NAME` — см. [configuration.md](configuration.md).

В stream попадают:

- события автодополнения / выбора подсказок;
- события fullness;
- логи ответов ML (`ml_response_log`).

Публикация: [`app/services/redis_stream.py`](../app/services/redis_stream.py).

## Worker

Процесс: `python -m app.workers.ml_mkb_events_worker` (compose-сервис `backend-worker`).

Читает consumer group из stream и пишет в Postgres:

| Таблица | Содержимое |
|--------|------------|
| `autocomplete_stats` | показы/клики автодополнения |
| `fullness_complaints_stats` | результаты проверки полноты жалоб |
| `ml_response_logs` | статус/payload ответов ML proxy |

Worker использует тот же image и entrypoint (migrate + seed), затем свою CMD.

## Questionnaire maintenance

Процесс: `python -m app.workers.questionnaire_maintenance` (compose `questionnaire-worker`).

Каждые ~10 минут:

1. `in_progress` без активности > `QUESTIONNAIRE_ABANDON_HOURS` → `abandoned`, ответы и ПДн стираются (`collect_form_state` тоже), `current_step` остаётся;
2. `completed` старше `QUESTIONNAIRE_RETENTION_DAYS` → удаление (у протокола остаётся `created_from_questionnaire`).

## Уточнения анкеты (`/collect_form`)

Публичный flow (`questionnaire_flow.request_ai_question`) вызывает `POST {ML_SERVICE_URL}/collect_form` через `proxy_post_to_ml` (без отдельного proxy-endpoint для врача).

- Запрос: `messages` + опциональный `state` из `questionnaire.collect_form_state`.
- Ответ: `status` (`question` / `complete` / `stopped`), вопрос в `messages`, новый `state` → в колонку (не в API UI).
- Лимиты backend: `QUESTIONNAIRE_AI_PRIMARY_MAX` / `QUESTIONNAIRE_AI_REPEAT_MAX`; без ключа `status` — эвристика конца сбора. Контракт для UI: [questionnaire-public.md](../../docs/contracts/questionnaire-public.md).

## Обработка анкеты после кода

Не через worker: сразу после выдачи кода (и по `POST /questionnaires/{id}/process`) FastAPI `BackgroundTasks` вызывает [`questionnaire_process.run_questionnaire_processing`](../app/services/questionnaire_process.py) → `POST {ML_SERVICE_URL}/summarize_form`. Результат в `questionnaire.structured` / `gaps` / `processing_status` (`pending` → `done` | `failed`). Timeout — тот же `QUESTIONNAIRE_AI_TIMEOUT`.

## Что не хранится в worker

Бизнес-факт выбора пациента в UI протоколов — только через HTTP API, не через stream.

## Dict-autocomplete без ML

`POST /autocomplete_dict/complete_dict` работает через SQL-функции `search_by_prefix` / `predict_by_prefix` по таблицам `ml_unigrams` / `ml_bigrams` (создаются миграцией `0005`). Данные словаря в seed refs **не** входят — таблицы могут быть пустыми, пока их не заполнят отдельно.


## Дополнительные ответы гастрочата — 08.11.2026

Обычная `kind=general` анкета первичного взрослого гастроэнтеролога после аллергии задаёт три фиксированных вопроса: стул, непреднамеренное изменение веса за 6 месяцев, болезни кровных родственников (рак желудка/кишечника, болезнь Крона, язвенный колит, целиакия). Отдельная гастроформа не включается. Ключи `stool_changes`, `weight_changes`, `family_history` хранятся как обычные строки ответов.

`gastro_chat_questions.append_gastro_chat_answers` дополняет готовую карточку после существующей ML-обработки: стул/вес → `complaints`, семейный анамнез → `life_anamnesis`. Текст этих ответов не перефразируется моделью; «Не знаю» не превращается в отрицание. Исходные строки остаются в `questionnaire_answer`; повторная обработка строит сводку заново и не накапливает повторные приложения. Если новых ответов нет, структура прежней записи не меняется. Схема БД и настройки ML не менялись.
