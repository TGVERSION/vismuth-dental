# Публичная анкета пациента

Без JWT. Состояние шагов на сервере. Токен сессии: `X-Questionnaire-Token`.  
Устройство: `X-Device-Id` (обязателен при старте).

Код: `routers/public_questionnaire.py`, `services/questionnaire_flow.py`.

## Ограничения ML (без правок ml-service)

Backend вызывает `POST {ML_SERVICE_URL}/collect_form` на шаге уточнений.  
Сигнала «вопросов достаточно» нет: лимит 6/2, skip, эвристика (нет `?`, пусто, >300 символов, повтор).  
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
