# Service user

**Настройки пользователей, 09.11.2026:** клиника, роль и специализации применяются автоматически атомарным запросом членства при допустимом полном наборе значений. Для врачебной роли сначала нужна специализация; до её выбора запрос не отправляется. Во время сохранения поля блокируются, при ошибке введённые значения сохраняются в карточке и доступны сообщение/повтор. Отдельных кнопок «Сохранить»/«Отмена» нет.

> **Breaking (роли):** `role` — новые коды; в read-ответах есть `role_name_ru`. Privileged = `super_admin` \| `admin` (не `administrator` / `head_of_department`).

Код: [`backend/app/routers/service_user.py`](../../backend/app/routers/service_user.py).

## GET /service_user

- **Auth:** JWT
- **Назначение:** профиль текущего пользователя («me»)
- **Поведение:** данные из JWT user
- **Ответ (смысл):** login, names, `role`, `role_name_ru`, is_active, timestamps (без `id` в схеме me — id брать из login/confirm `user.id`)
- **Frontend:** auth store / профиль после login
- **Код:** `get_service_user_me`

## GET /service_user_ids

- **Auth:** privileged
- **Назначение:** список пользователей для админ-UI
- **Поведение:** не soft-deleted; order by created_at desc
- **Ответ (смысл):** `{ id, login, role, role_name_ru }[]`
- **Frontend:** экран «Пользователи» в settings
- **Код:** `list_service_user_ids`

## GET /service_user/{user_id}

- **Auth:** privileged
- **Назначение:** полный профиль по id
- **Поведение:** `404` если нет или soft-deleted
- **Ответ (смысл):** профиль + `role` / `role_name_ru`
- **Frontend:** детали пользователя (если нужны)
- **Код:** `get_service_user`

## PUT /service_user/{user_id}

- **Auth:** privileged
- **Назначение:** полная замена полей пользователя
- **Поведение:** login / names / `role` / is_active / optional password; `set_user_role`; `409` duplicate login
- **Ответ (смысл):** обновлённый профиль с `role` / `role_name_ru`
- **Frontend:** редко; предпочтительнее PATCH
- **Код:** `replace_service_user`

## PATCH /service_user/{user_id}

- **Auth:** privileged
- **Назначение:** частичное обновление (в т.ч. роли)
- **Поведение:** `400` если body пустой; `role` ∈ `super_admin|admin|doctor|patient`
- **Ответ (смысл):** обновлённый профиль с актуальными `role` / `role_name_ru`
- **Frontend:** смена роли в dropdown → `{ role: "<code>" }`
- **Код:** `patch_service_user`

## DELETE /service_user/{user_id}

- **Auth:** privileged
- **Назначение:** soft-delete пользователя
- **Поведение:** ставит `deleted_at`; `204`
- **Frontend:** кнопка удаления в settings
- **Код:** `delete_service_user`
