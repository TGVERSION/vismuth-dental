# Protocol structures & fields-main

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
