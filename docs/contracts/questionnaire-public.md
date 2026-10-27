# Публичная анкета пациента

Без JWT. Состояние шагов на сервере. Токен сессии: `X-Questionnaire-Token`.  
Устройство: `X-Device-Id` (обязателен при старте).

Код: `routers/public_questionnaire.py`, `services/questionnaire_flow.py`.

## Ограничения ML

Backend вызывает `POST {ML_SERVICE_URL}/collect_form` на шаге уточнений.  
В запрос уходит история `messages` и сохранённый `state` (FormProgress); ответ с `status` (`question` / `complete` / `stopped`) и новым `state` бэкенд хранит в `questionnaire.collect_form_state` и **не** отдаёт в UI.  
Для фронта сигнала «вопросов достаточно» нет: шаги те же (`ai_clarify` → фиксированные). Стоп по `status`, лимит 6/2; без ключа `status` (старый ml-service) — эвристика (нет `?`, пусто, >300 символов, повтор).  
Специализация и тип приёма — первая служебная реплика в `messages`.  
Timeout: `QUESTIONNAIRE_AI_TIMEOUT` (~20s). Ошибка → `ai_unavailable`, фиксированные вопросы продолжаются.

После выдачи кода (`patient_info` → `completed`) backend ставит `processing_status=pending` и в BackgroundTasks вызывает `POST {ML_SERVICE_URL}/summarize_form` (ответ пациенту ML не ждёт).

## GET /public/links/{slug}

- **Auth:** none
- **Назначение:** открыть ссылку клиники или врача (брендинг, список врачей / выбранный врач)
- **Поведение:** slug ищется в `clinic.public_slug` или `clinic_membership.public_slug`. Заглушки: `subscription_expired`, `clinic_daily_limit`, `doctor_inactive` (+ список активных врачей)
- **Ответ:** `link_type`, брендинг, `doctors[]`, опционально `doctor`, `blocked` / `block_code` / `block_message`
- **Frontend:** первый экран анкеты / QR
- **Код:** `get_public_link`

## POST /public/questionnaires

- **Auth:** none + `X-Device-Id`
- **Назначение:** начать анкету
- **Поведение:** проверка подписки, суточного лимита клиники, Redis-лимитов device (5/час) и IP (30/час); создаёт `questionnaire`, возвращает `id` + `token` + текущий `step`. Врач по doctor-slug предзаполнен; одна специализация → шаг выбора пропускается
- **Ошибки:** `429` device_limit / ip_limit; `503` subscription_expired / clinic_daily_limit
- **Код:** `create_questionnaire`

## GET /public/questionnaires/{id}/step

- **Auth:** `X-Questionnaire-Token`
- **Назначение:** дескриптор текущего шага (тип, текст, choices, код)
- **Код:** `get_step`

## POST /public/questionnaires/{id}/answer

- **Auth:** `X-Questionnaire-Token`
- **Назначение:** ответ на текущий шаг → следующий дескриптор
- **Поведение:** валидация `step_key`; обрезка текста до 1000 (`truncated: true`); на `ai_clarify` — вызов `/collect_form`; финал `patient_info` выдаёт 4-значный код (уникален в клинике 30 дней) и запускает фоновую обработку (`summarize_form`)
- **Тело:** `step_key` + `value` / `choice` / `skip` / `none` / поля выбора врача / patient_info
- **patient_info:** `appointment_time` — любое `HH:MM` (00:00–23:59)
- **Код:** `post_answer`

## Стоматологическая анкета (`kind=dental`)

Код: `services/dental/` (`questions.py` — набор вопросов, `flow.py` — шаги, `summary.py` — карточка врача). Ответы хранятся в `questionnaire.dental_answers` (JSONB), при брошенной анкете стираются. ML не вызывается: карточка врача собирается правилами сразу после последнего ответа (`processing_status=done`). Как создаётся такая анкета (персональная ссылка регистратуры) — следующий этап.

Шаги: `dental_reason` → `dental_pain` (только если выбрано `pain`) → `dental_health` → `dental_details` (только по отмеченным строкам; при `none` шаг пропускается) → `done`.

| step_type | Что в дескрипторе | Тело ответа |
|-----------|-------------------|-------------|
| `chip_groups` | `groups[]`: `{key, title, question, options[{value,label}], multiple, required, text: {placeholder, required} \| null}` | `selections: {key: [value…]}`, `texts: {key: "…"}` |
| `checklist` | `choices[]`: `{value, label, hint}`, `allow_none=true` | `selections: {"health": [value…]}` или `none: true` |
| `done` | `completed=true`, `title` | — |

Проверки (400 с текстом причины): значение не из `options`; больше одного значения при `multiple=false`; пустой выбор при `required`; группа не с этого шага или не по отмеченной строке; текст в группе без поля; нет текста при `text.required` или выбранном `other`; на `checklist` — и строки, и `none`, или ничего. Текст режется до 1000 символов (`truncated: true`).

У врача (`GET /questionnaires/{id}`) `kind=dental`, `structured`: `important[]` (красные строки), `complaints`, `health[]` (`{key, label, has, detail}` по всем 9 строкам), `medications`, `allergy_anamnesis`, `life_anamnesis`; `gaps[]` — «Что доспросить». Ключи `complaints/medications/allergy_anamnesis/life_anamnesis` те же, что у общей анкеты, — по ним создаётся протокол. `POST /questionnaires/{id}/process` для `dental` пересобирает карточку правилами.

## GET /public/invites/{token}

- **Auth:** none — токен персональной ссылки
- **Назначение:** открыть анкету, созданную регистратурой ([clinic-questionnaires.md](clinic-questionnaires.md))
- **Ответ:** `questionnaire_id`, брендинг клиники, `doctor`, `patient_first_name`, `patient_middle_name`, `appointment_date`, `appointment_time`, `step`. Фамилию пациенту не отдаём
- **Блокировки:** `blocked=true` + `block_code`: `invite_expired` (срок ссылки истёк, анкета не заполнена), `subscription_expired` (подписка истекла, а пациент ещё не начинал). Заполненная анкета открывается всегда — шаг `done`
- **Ошибки:** `404` `invite_not_found` (нет такой ссылки, выпущена новая или анкета удалена)
- **Дальше:** `GET/POST /public/questionnaires/{questionnaire_id}/step|answer` с этим токеном в `X-Questionnaire-Token`. Первый ответ переводит `invited` → `in_progress`; после срока ссылки ответы — `410`
