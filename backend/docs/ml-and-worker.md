# ML proxy и worker

## HTTP proxy

Сервис [`app/services/ml_proxy.py`](../app/services/ml_proxy.py) ходит в upstream `ML_SERVICE_URL` (по умолчанию `http://ml-service:8000`).

Роутеры backend (`ml_autocomplete`, `ml_mkb_code`, `ml_fullness`, `ml_clinrec_check`):

1. проверяют JWT / пользователя;
2. проксируют тело запроса в ml-service;
3. при наличии контекста публикуют событие лога ответа в Redis Stream.

Ошибки upstream превращаются в HTTP-ошибки FastAPI с `detail` от ml-service, если он есть.

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

## Dict-autocomplete без ML

`POST /autocomplete_dict/complete_dict` работает через SQL-функции `search_by_prefix` / `predict_by_prefix` по таблицам `ml_unigrams` / `ml_bigrams` (создаются миграцией `0005`). Данные словаря в seed refs **не** входят — таблицы могут быть пустыми, пока их не заполнят отдельно.
