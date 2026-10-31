# Анкеты врача

JWT + активный `clinic_membership` с `is_doctor`. Видны только анкеты своего membership (`status=completed`).

Код: `routers/questionnaires.py`. Фоновая обработка: `services/questionnaire_process.py` → `POST {ML_SERVICE_URL}/summarize_form`.

Для `kind=gastro` сводка и повторная обработка собираются правилами, без `summarize_form`. Подробности: [гастроанкета](gastro-questionnaire.md).

## GET /questionnaires

- **Auth:** JWT (doctor membership)
- **Назначение:** список анкет с фильтрами
- **Query:** `name`, `date` (по умолчанию сегодня; при `code` без `date` — все дни), `visit_type`, `code`
- **Какие анкеты:** свои общие (по дню приёма) и все стоматологические анкеты клиники — они к врачу не привязаны, день у них — день заполнения (UTC). Детали, повторная обработка и протокол — по тому же правилу
- **Строка:** время, имя/отчество, тип, специализация, `protocol_id`, код
- **Код:** `list_questionnaires`

## GET /questionnaires/{id}

- **Auth:** JWT (свой doctor)
- **Назначение:** карточка: исходные ответы, `ai_unavailable`, `structured` / `gaps` / `processing_status`, `protocol_id`
- **Поля обработки:** `processing_status` — `pending` | `done` | `failed` (или null у старых анкет); `structured` — `{complaints, medications, allergy_anamnesis, life_anamnesis}` после успешного summarize; `gaps` — список пробелов, если ML вернул ключ (сейчас обычно `[]`)
- **Код:** `get_questionnaire`

Гастрокарточка дополнительно содержит `important[]`, `safety`, `history` (дословный `raw`, факты `chronology` с исходными периодами), `clarifications`, `raw_answers`, отдельный упорядоченный `patient_questions[]`. Неотмеченные признаки не считаются отрицаниями. Даже при отсутствии сохранённого `structured` карточка и перенос в протокол пересобираются из `gastro_answers`. Вопросы пациента не включаются в поля протокола; история сохраняется в `life_anamnesis`. Анкеты без времени сортируются в пределах дня по времени завершения, новые выше.

## POST /questionnaires/{id}/process

- **Auth:** JWT (свой doctor)
- **Назначение:** повторная фоновая обработка анкеты через `/summarize_form` (тратит токены ML)
- **Поведение:** тот же helper, что у ML proxy (`ensure_user_clinic_subscription_active`): `503` + `subscription_expired` при истёкшем доступе клиники; `processing_status=pending`; ответ `202` с detail; ML в BackgroundTasks. При ошибке/таймауте — `failed`, исходные ответы и прежний `structured` не затираются
- **Код:** `process_questionnaire`

## POST /questionnaires/{id}/protocol

- **Auth:** JWT (свой doctor)
- **Назначение:** создать ровно один протокол из анкеты
- **Тело:** `protocol_structure_id`, опционально `protocol_name`
- **Поведение:** `FOR UPDATE`; `409` если протокол уже есть; если есть `structured` — перенос `complaints` / `life_anamnesis` / `allergy_anamnesis`; препараты в поле с `field_name=medications`, иначе дописываются в жалобы. Без `structured` — механический маппинг сырых ответов (+ диалог ИИ в жалобы). `source_questionnaire_id`, `created_from_questionnaire=true`. Не тратит токены ML — доступно при истёкшей подписке
- **Код:** `create_protocol_from_questionnaire`
