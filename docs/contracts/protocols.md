# Protocols — `/protocols`

Код: [`backend/app/routers/protocols.py`](../../backend/app/routers/protocols.py).

Все endpoint'ы: **JWT**. Доступ только к своим протоколам (`service_user == current_user`); чужие → `404`. Role-checks нет.

## GET /protocols

- **Auth:** JWT
- **Назначение:** список своих неудалённых протоколов
- **Поведение:** order by updated/created
- **Frontend:** список консультаций / протоколов
- **Код:** `list_protocols`

## GET /protocols/{id}

- **Auth:** JWT (owner)
- **Назначение:** протокол + значения полей
- **Поведение:** `field_values` map; `404` чужой/нет
- **Код:** `get_protocol`

## POST /protocols

- **Auth:** JWT
- **Назначение:** создать протокол по structure + fields
- **Поведение:** валидация structure / required; `201`
- **Код:** `create_protocol`

## PUT /protocols/{id}

- **Auth:** JWT (owner)
- **Назначение:** полная замена metadata + field_values
- **Поведение:** `400` без structure / невалидные fields
- **Код:** `put_protocol`

## PATCH /protocols/{id}

- **Auth:** JWT (owner)
- **Назначение:** частичное обновление metadata + upsert fields
- **Поведение:** required-поля нельзя очистить
- **Код:** `patch_protocol`

## DELETE /protocols/{id}

- **Auth:** JWT (owner)
- **Назначение:** удаление протокола
- **Поведение:** hard delete; `204`
- **Код:** `delete_protocol`
