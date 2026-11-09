# Protocol structures & fields-main

**Настройки, 09.11.2026:** редактор применяет изменения автоматически после короткой паузы ввода, последовательно. Новая структура создаётся после ввода непустого названия. Существующая обновляется через PATCH с сохранением идентификаторов и имён полей; PUT для автосохранения не используется. Перед закрытием/сменой раздела ожидается завершение сохранения, ошибка оставляет редактор и введённые значения открытыми; доступны повтор и автоматическая попытка при восстановлении связи. Кнопок «Сохранить» нет.

POST/PATCH не повторяются транспортом вслепую. После неопределённого результата редактор перечитывает свою запись, проверяя код, версию и поля. Точное совпадение подтверждает сохранение и новые ID; неизменившееся исходное состояние допускает повтор той же операции, конфликт/недоступность чтения оставляет ошибку. Новый редактор получает постоянный случайный код. «Вернуться к списку» прекращает локальные попытки и перечитывает список, не обещая откат уже применённой серверной записи.

Код: [`protocol_structures.py`](../../backend/app/routers/protocol_structures.py), [`protocol_fields_main.py`](../../backend/app/routers/protocol_fields_main.py).

Role-checks нет. Structures: list/get — все JWT; C/U/D — только owner (`creator_id`).

## GET /protocol-structures

- **Auth:** JWT
- **Назначение:** список структур протоколов (не только свои)
- **Код:** `list_protocol_structures`

## GET /protocol-structures/{id}

- **Auth:** JWT
- **Назначение:** структура + fields; `404` если нет
- **Код:** `get_protocol_structure`

## POST /protocol-structures

- **Auth:** JWT
- **Назначение:** создать структуру (`creator_id` = current user) + fields
- **Поведение:** `409` / `500` на conflict/DB
- **Код:** `create_protocol_structure`

## PUT /protocol-structures/{id}

- **Auth:** JWT (owner; иначе `404`)
- **Назначение:** полная замена структуры и fields
- **Код:** `put_protocol_structure`

## PATCH /protocol-structures/{id}

- **Auth:** JWT (owner)
- **Назначение:** частичное обновление; fields add/update/delete
- **Поведение:** `400` / `409`
- **Код:** `patch_protocol_structure`

## DELETE /protocol-structures/{id}

- **Auth:** JWT (owner)
- **Назначение:** hard delete; `204`
- **Код:** `delete_protocol_structure`

---

## GET /protocol-fields-main

- **Auth:** JWT
- **Назначение:** справочник ключевых полей протоколов
- **Код:** `list_protocol_fields_main`

## GET /protocol-fields-main/{field_id}

- **Auth:** JWT
- **Назначение:** одно поле справочника; `404`
- **Код:** `get_protocol_field_main`
