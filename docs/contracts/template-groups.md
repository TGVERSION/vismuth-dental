# Template groups — `/template-groups`

Код: [`backend/app/routers/template_groups.py`](../../backend/app/routers/template_groups.py).

Все: **JWT**, только группы текущего `creator_id`. Role-checks нет.

## GET /template-groups

- **Auth:** JWT
- **Назначение:** свои группы шаблонов (`id`, `name`)
- **Frontend:** фильтр / привязка шаблона к группе
- **Код:** `list_template_groups`

## POST /template-groups

- **Auth:** JWT
- **Назначение:** создать группу
- **Поведение:** `400` пустое имя; `409` duplicate name (case-insensitive)
- **Код:** `create_template_group`

## PUT /template-groups/{id}

- **Auth:** JWT (owner)
- **Назначение:** переименовать
- **Поведение:** `404` чужая/нет; unique name
- **Код:** `update_template_group`

## DELETE /template-groups/{id}

- **Auth:** JWT (owner)
- **Назначение:** удалить группу
- **Поведение:** у связанных templates `group_id` → null; hard delete group; `204`
- **Код:** `delete_template_group`
