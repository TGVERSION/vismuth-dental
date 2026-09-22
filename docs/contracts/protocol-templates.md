# Protocol templates — `/protocol-templates`

> **Breaking (роли):** общие шаблоны (`privacy: general`) — только `super_admin` \| `admin` (раньше `administrator` \| `head_of_department`).

Код: [`backend/app/routers/protocol_templates.py`](../../backend/app/routers/protocol_templates.py).

Все: **JWT**. Личные (`personal`) — creator; общие (`general`) — C/U/D только privileged.

## GET /protocol-templates

- **Auth:** JWT
- **Назначение:** список доступных шаблонов
- **Поведение:** все `general` + `personal` текущего creator
- **Frontend:** выбор шаблона протокола
- **Код:** `list_protocol_templates`

## GET /protocol-templates/{id}

- **Auth:** JWT (accessible)
- **Назначение:** шаблон + fields
- **Поведение:** `404` если недоступен
- **Код:** `get_protocol_template`

## POST /protocol-templates

- **Auth:** JWT; `privacy=general` → privileged
- **Назначение:** создать шаблон
- **Поведение:** `403` если general без privileged; group должна быть своей; structure должна существовать
- **Frontend:** создание личного шаблона; general — только admin UI
- **Код:** `create_protocol_template`

## PUT /protocol-templates/{id}

- **Auth:** JWT + privacy rules
- **Назначение:** обновить шаблон (в т.ч. fields)
- **Поведение:** personal — только creator; general — privileged; смена на general — privileged; `400`/`403`/`404`
- **Код:** `update_protocol_template`

## DELETE /protocol-templates/{id}

- **Auth:** JWT + privacy rules
- **Назначение:** удалить шаблон
- **Поведение:** те же правила privacy; hard delete template+fields; `204`
- **Код:** `delete_protocol_template`
