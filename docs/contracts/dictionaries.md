# Dictionaries & MKB-10

Код: [`dictionaries.py`](../../backend/app/routers/dictionaries.py), [`mkb10.py`](../../backend/app/routers/mkb10.py).  
Whitelist ref-таблиц: `backend/app/dictionaries_config.py`.

Все ниже: **JWT**, без role-checks.

## GET /dictionary

- **Auth:** JWT
- **Назначение:** реестр словарей (OID → имя `ref_*`)
- **Поведение:** активные записи `Dictionary`
- **Frontend:** список справочников в settings
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
- **Поведение:** `page` / `size`; опц. `searchValue`; `500` если нет таблицы. Ответ: page, size, totalCount, items[{code,name}]
- **Frontend:** подбор кода диагноза
- **Код:** `search_mkb10`
