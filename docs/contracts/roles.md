# Roles — `/roles`

См. также [`../domains/roles-and-permissions.md`](../domains/roles-and-permissions.md).

Код: [`backend/app/routers/roles.py`](../../backend/app/routers/roles.py).

## GET /roles

- **Auth:** JWT (любая роль)
- **Назначение:** справочник ролей для UI
- **Поведение:** все строки таблицы `role`, сортировка по `name`
- **Ответ (смысл):** массив `{ name, name_ru }` — код и подпись
- **Frontend:** options для dropdown смены роли (value=`name`, label=`name_ru`); не хардкодить список
- **Код:** `list_roles`
