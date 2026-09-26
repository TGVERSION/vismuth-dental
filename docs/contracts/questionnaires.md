# Анкеты врача

JWT + активный `clinic_membership` с `is_doctor`. Видны только анкеты своего membership (`status=completed`).

Код: `routers/questionnaires.py`.

## GET /questionnaires

- **Auth:** JWT (doctor membership)
- **Назначение:** список анкет с фильтрами
- **Query:** `name`, `date` (по умолчанию сегодня; при `code` без `date` — все дни), `visit_type`, `code`
- **Строка:** время, имя/отчество, тип, специализация, `protocol_id`, код
- **Код:** `list_questionnaires`

## GET /questionnaires/{id}

- **Auth:** JWT (свой doctor)
- **Назначение:** карточка: исходные ответы, `ai_unavailable`, зарезервированные `structured`/`gaps`, `protocol_id`
- **Код:** `get_questionnaire`

## POST /questionnaires/{id}/protocol

- **Auth:** JWT (свой doctor)
- **Назначение:** создать ровно один протокол из анкеты
- **Тело:** `protocol_structure_id`, опционально `protocol_name`
- **Поведение:** `FOR UPDATE`; `409` если протокол уже есть; поля с `protocol_fields_main` `complaints` / `life_anamnesis` / `allergy_anamnesis` заполняются из ответов (+ диалог ИИ в жалобы); `source_questionnaire_id`, `created_from_questionnaire=true`. Не тратит токены ML — доступно при истёкшей подписке
- **Код:** `create_protocol_from_questionnaire`
