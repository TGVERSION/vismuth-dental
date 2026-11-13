# Dictionaries & MKB-10

Код: [`dictionaries.py`](../../backend/app/routers/dictionaries.py), [`mkb10.py`](../../backend/app/routers/mkb10.py).  
Whitelist ref-таблиц: `backend/app/dictionaries_config.py` (включая `ref_specialization`).  
Для UI клиники предпочтителен `GET /specializations` ([clinic-admin.md](clinic-admin.md)).

Все ниже: **JWT**, без role-checks.

## GET /dictionary

- **Auth:** JWT
- **Назначение:** реестр словарей (OID → имя `ref_*`)
- **Поведение:** активные записи `Dictionary`
- **Frontend:** список справочников в settings
- **Настройки:** справочники доступны для просмотра и постраничной загрузки. Создание/редактирование не предлагаются: API записи нет. Удалены прежние несохраняемые локальные правки и неработающая кнопка «Сохранить».
- **Код:** `list_dictionary`

## GET /ref/{name}

- **Auth:** JWT
- **Назначение:** поиск по whitelist ref-таблице
- **Поведение:** query `search` / `limit` / `offset`; `404` нет в dictionary; `400` не whitelisted / search unsupported
- **Frontend:** автодополнение / выбор значений справочника
- **Код:** `get_ref_values`

## GET /mkb10

- **Auth:** JWT
- **Назначение:** поиск по МКБ-10
- **Поиск:** частичное совпадение без учёта регистра по строке «код - название». Без `searchValue` или при пустой строке выдаётся весь справочник по страницам. Сортировка по возрастанию кода.
- **Пагинация:** `page` начинается с 1, `size` от 1 до 100. `totalCount` учитывает все совпадения. При выходе за пределы списка возвращаются `200` и пустой `items`.
- **Ошибки:** `401` — аутентификация, `403` — доступ, `422` — параметры, `500` — внутренняя ошибка.
- **Frontend:** подбор кода диагноза
- **Код:** `search_mkb10`
