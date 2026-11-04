# Super-admin clinics — `/super-admin/clinics`

Код: [`backend/app/routers/super_admin/clinics.py`](../../backend/app/routers/super_admin/clinics.py).  
Helpers: [`backend/app/services/clinic_access.py`](../../backend/app/services/clinic_access.py).

**Auth всех endpoint'ов ниже:** JWT + роль `super_admin` (не `admin`). Иначе `403`.

Статус подписки в ответах вычисляется:

| `access_status_code` | Когда | `access_status_label` |
|----------------------|-------|------------------------|
| `trial` | тип trial, дата не прошла | «Пробный период до ДД.ММ.ГГГГ» |
| `paid` | тип paid, дата не прошла | «Подписка до ДД.ММ.ГГГГ» |
| `expired` | дата в прошлом | «Подписка завершена» |

`doctors_count` = активные membership с `is_doctor` + незавершённые (не used, не deleted, не expired) invitations с `is_doctor`.

В list/get также: `free_codes_ratio` (доля свободных 4-значных кодов за 30 дней), `clinic_daily_limit_exceeded` (предупреждения супер-админу), `questionnaires_completed_month` (заполненные анкеты за текущий календарный месяц UTC).

Поля `logo_url` / `photo_url` — URL под будущее S3; загрузки файлов нет.
Invite врача: `specialization_ids` обязательны при `is_doctor=true` (см. [clinic-admin.md](clinic-admin.md)).

Статистика по всем клиникам: [questionnaire-statistics.md](questionnaire-statistics.md) (`GET /super-admin/statistics`).

## POST /super-admin/clinics

- **Назначение:** создать клинику
- **Поведение:** генерирует immutable `public_slug`; `201`. `questionnaire_kind`: `general` (по умолчанию — многопрофильная, обычные анкеты по ссылке и QR), `dental` (стоматология, только персональные ссылки регистратуры) или `mixed` (оба направления одновременно). В `mixed` общая ссылка и ссылки врачей запускают обычный сценарий, персональные приглашения — стоматологический, см. [clinic-questionnaires.md](clinic-questionnaires.md). Существующие клиники сохраняют прежний режим; новый включается супер-администратором.
- **Ответ (смысл):** карточка клиники + computed access status, `doctors_count=0`
- **Frontend:** форма создания в супер-админке
- **Код:** `create_clinic`

## GET /super-admin/clinics

- **Назначение:** список клиник (`deleted_at IS NULL`)
- **Поведение:** сортировка по `created_at` desc
- **Frontend:** таблица всех клиник
- **Код:** `list_clinics`

## GET /super-admin/clinics/{clinic_id}

- **Назначение:** карточка клиники
- **Поведение:** `404` если нет / soft-deleted
- **Код:** `get_clinic`

## PATCH /super-admin/clinics/{clinic_id}

- **Назначение:** частичное обновление (name, phone, email, logo_url, brand_color, doctors_limit, access_*, questionnaire_kind)
- **Поведение:** `public_slug` не меняется; выставляет `updated_at`. `questionnaire_kind: null` → `400`. Смена типа не трогает начатые анкеты: у каждой свой `kind`, она дозаполняется по прежним правилам
- **Код:** `patch_clinic`

## DELETE /super-admin/clinics/{clinic_id}

- **Назначение:** soft-delete
- **Поведение:** ставит `deleted_at`; клиника исчезает из списков
- **Код:** `delete_clinic`

## POST /super-admin/clinics/{clinic_id}/invitations

- **Назначение:** пригласить человека в клинику (обычно первого clinic admin)
- **Поведение:** нужен `is_clinic_admin` или `is_doctor`; `409` если user/pending invite с этим email уже есть; создаёт `clinic_invitation` (TTL `INVITE_EXPIRE_DAYS`); шлёт письмо; в ответе всегда `invite_url` (raw token один раз) + `email_sent` / `email_error`
- **Frontend:** форма invite; при `email_sent=false` показать ссылку вручную
- **Код:** `create_invitation`

## GET /super-admin/clinics/{clinic_id}/invitations

- **Назначение:** список приглашений клиники (без soft-deleted)
- **Код:** `list_invitations`

## POST /super-admin/clinics/{clinic_id}/invitations/{invitation_id}/resend

- **Назначение:** новый token + новый TTL + повторное письмо
- **Поведение:** старый token перестаёт работать; `400` если уже used; `404` если нет
- **Код:** `resend_invitation`

Accept / preview приглашения — публичные ручки в [auth.md](auth.md).
