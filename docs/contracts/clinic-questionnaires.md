# Анкеты пациентов у регистратуры (админ клиники)

JWT + `is_clinic_admin` в этой клинике (или `super_admin`). Только для клиники с `questionnaire_kind=dental`: регистратура создаёт пациенту персональную ссылку по ФИО, видит статус, печатает и отмечает подписанные анкеты. Код: `routers/clinic_questionnaires.py`, `services/questionnaire_invites.py`.

Как бумажная стоматологическая анкета, ссылка не привязана ни к врачу, ни к дате приёма: `doctor_membership_id` и `appointment_*` у такой анкеты пустые. Заполненную анкету видят все врачи клиники (см. [questionnaires.md](questionnaires.md)).

Ссылка `{FRONTEND_PUBLIC_URL}/q/i/{token}` показывается один раз: в базе лежит только хэш токена. Работает 7 дней с момента создания; незаполненная анкета после срока удаляется воркером. По бездействию такая анкета не бросается.

Статусы в списке: `invited` (ссылка отправлена) → `in_progress` (пациент начал) → `completed` (заполнена) → `printed` → `signed`.

## POST /clinics/{clinic_id}/questionnaires

- **Тело:** `last_name`, `first_name`, `middle_name?`
- **Ответ 201:** строка списка + `url`
- **Ошибки:** `400` нет фамилии/имени; `409` клиника не стоматологическая; `503` подписка клиники истекла

## GET /clinics/{clinic_id}/questionnaires

- **Query:** `status` (`invited | in_progress | completed | printed | signed`), `name` (часть фамилии, имени или отчества)
- **Строка:** `id, status, patient_last_name, patient_first_name, patient_middle_name, created_at, completed_at, printed_at, signed_at, invite_expires_at`; новые сверху, не больше 300

## GET /clinics/{clinic_id}/questionnaires/{id}

Строка + `structured`, `gaps` — карточка как у врача (для экрана и печати).

## POST /clinics/{clinic_id}/questionnaires/{id}/link

Новая ссылка `{url}`, прежняя перестаёт работать. `409` — анкета заполнена, `410` — срок ссылки истёк.

## POST /clinics/{clinic_id}/questionnaires/{id}/printed · /signed

Ставит `printed_at` / `signed_at` (повторный вызов не меняет время). `409` — анкета ещё не заполнена.

## DELETE /clinics/{clinic_id}/questionnaires/{id}

`204`. Ошибочная ссылка; заполненную удалить нельзя (`409`).

## Публичная сторона

`GET /public/invites/{token}` — см. [questionnaire-public.md](questionnaire-public.md). Общая ссылка клиники и врача у стоматологической клиники закрыта: `GET /public/links/{slug}` → `blocked`, `block_code=invite_only`; `POST /public/questionnaires` → `403`.
