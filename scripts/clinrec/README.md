# Загрузка клинических рекомендаций в локальный S3

Скрипт скачивает PDF с [рубрикатора Минздрава](https://cr.minzdrav.gov.ru/clin-rec) через API `apicr.minzdrav.gov.ru` и кладёт их в бакет `vismuth-clinrec`.

Ключ объекта: `guidelines/{source_id}/{revision}/source.pdf`  
Пример: `guidelines/157/5/source.pdf` ← `id=157_5`.

## Пререквизиты

1. Python 3.10+
2. Файл [`vismuth/.env`](../../.env) с `S3_*` (см. [`.env.template`](../../.env.template))
3. Поднятое хранилище:

```bash
cd vismuth
docker compose up -d minio minio-init
```

## Запуск

Из корня `vismuth/`:

```bash
./scripts/clinrec/run_download.sh
```

Smoke (первые 5 найденных КР):

```bash
./scripts/clinrec/run_download.sh --limit 5
```

Только обход каталога без put:

```bash
./scripts/clinrec/run_download.sh --dry-run --limit 10
```

Обёртка сама:

- подхватывает `.env`;
- подменяет `S3_ENDPOINT_URL=http://minio:9000` → `http://127.0.0.1:9000` для запуска с хоста;
- создаёт venv `scripts/clinrec/.venv` и ставит зависимости;
- проверяет доступность бакета перед загрузкой.

Прямой вызов Python (если env уже настроен):

```bash
./scripts/clinrec/.venv/bin/python scripts/clinrec/download_to_s3.py --limit 5
```

## Идемпотентность

Повторный запуск делает `head_object` по ключу. Если объект есть и размер совпадает с PDF на стороне Минздрава — статус `skip`, повторной загрузки нет.

Локальный журнал: `scripts/clinrec/.cache/manifest.jsonl` (в `.gitignore`). Source of truth — бакет S3, не манифест.

## Как устроен каталог

Официального list-all API нет. Скрипт перебирает `source_id` от 1 до `--max-id` (default 1500). Для каждого id идёт по `revision` вверх от 1: PDF должен начинаться с `%PDF`. Как только следующий номер отдаёт **тот же** файл (API алиасит завышенную редакцию на latest) — берётся предыдущий номер. После `--empty-streak` (default 80) подряд пустых id (когда уже были находки) останавливается.

## Полезные флаги

| Флаг | Default | Смысл |
|------|---------|--------|
| `--max-id` | 1500 | Верхняя граница id |
| `--max-revision` | 20 | Макс. номер редакции |
| `--empty-streak` | 80 | Стоп после серии пустых id |
| `--delay` | 0.3 | Пауза между HTTP-запросами к Минздраву (сек) |
| `--limit` | 0 | Обработать только N найденных (0 = все) |
| `--dry-run` | off | Не писать в S3 |

## Консоль MinIO / Silo

http://localhost:9001 — логин/пароль из `S3_ACCESS_KEY` / `S3_SECRET_KEY` (в template: `minioadmin`).
