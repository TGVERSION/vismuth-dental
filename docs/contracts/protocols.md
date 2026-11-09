# Protocols — `/protocols`

**Исправление компоновки, 09.11.2026:** открытый протокол и состояния загрузки/ошибки начинаются после списка слева (отступ 374 px). Оглавление находится в собственном месте внутри карточки, а не фиксируется поверх списка. Оглавление и текст имеют независимую прокрутку; при узкой карточке оглавление скрывается. Высота ограничена окном с учётом двухрядной шапки до 1200 px. Переход по оглавлению рассчитывается относительно прокручиваемого контейнера, а не `offsetParent`. API, тексты и поля протоколов не менялись.

Код: [`backend/app/routers/protocols.py`](../../backend/app/routers/protocols.py).

Все endpoint'ы: **JWT**. Доступ только к своим протоколам (`service_user == current_user`); чужие → `404`. Role-checks нет.

В ответах: `source_questionnaire_id`, `created_from_questionnaire` (пометка «создан из анкеты» переживает удаление анкеты через 45 дней). Создание из анкеты — `POST /questionnaires/{id}/protocol` ([questionnaires.md](questionnaires.md)).

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
