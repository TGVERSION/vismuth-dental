# User settings — `/user-settings`

Код: [`backend/app/routers/user_settings.py`](../../backend/app/routers/user_settings.py).

Доступ: JWT + свой `user_id` **или** privileged (`super_admin` \| `admin`).

Поля настроек (смысл): `mkb_code`, `autocomplete`, `fullness_complaints`.

## GET /user-settings/{user_id}

- **Auth:** JWT + access
- **Назначение:** прочитать настройки помощников
- **Поведение:** `403` чужой без privileged; `404` если записи нет
- **Frontend:** загрузка toggles после login
- **Код:** `get_user_settings`

## POST /user-settings/{user_id}

- **Auth:** JWT + access
- **Назначение:** создать settings (если ещё нет)
- **Поведение:** `201`; `404` user; `409` уже существуют
- **Frontend:** редко (обычно создаются при регистрации)
- **Код:** `create_user_settings`

## PUT /user-settings/{user_id}

- **Auth:** JWT + access
- **Назначение:** полная замена трёх полей
- **Поведение:** `404` если нет записи
- **Код:** `replace_user_settings`

## PATCH /user-settings/{user_id}

- **Auth:** JWT + access
- **Назначение:** частичное обновление
- **Поведение:** `400` пустой patch; `404`
- **Frontend:** переключение отдельных помощников
- **Код:** `patch_user_settings`
