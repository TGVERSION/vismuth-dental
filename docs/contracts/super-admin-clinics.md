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

## Клиника и роль существующего пользователя

Только `super_admin`:

- `GET /super-admin/users` возвращает неудалённых пользователей, ФИО (`first_name`, `last_name`, `middle_name`, могут быть null), почту, состояние учётной записи, платформенную роль, текущую активную клинику, роль членства и специализации. Паролей и токенов в ответе нет.
- `GET /super-admin/user-membership-roles` — справочник кодов/подписей для выбора роли членства: врач, оператор контакт-центра, администратор клиники, администратор и врач.
- `PUT /super-admin/users/{user_id}/membership` назначает клинику и роль членства. Передаются `clinic_id`, `clinic_role`, `specialization_ids`; врач требует непустые специализации, остальные роли — пустой список. `clinic_id=null` вместе с `clinic_role=null` снимает членство и закрывает рабочие API до нового назначения.

Назначение допускается активной учётной записи с платформенной ролью `doctor`; для `admin`/`patient` сначала нужно явно сменить платформенную роль, для `super_admin` назначение запрещено (`409`). Платформенная роль при переводе автоматически не меняется. Оператор остаётся флагом членства, без прав платформенного администратора.

Перевод атомарно деактивирует прежнее членство, создаёт либо повторно активирует членство целевой клиники и снимает ограничение ожидания. Подписка, удаление клиники, специализации и лимит врачей проверяются до изменения прав; действующий врач той же клиники повторный слот не занимает. Клиника и ссылки исторических анкет не переносятся; деактивированная врачебная ссылка недоступна. Повторное назначение той же клиники сохраняет ID членства. Блокировки целевой клиники и пользователя сериализуют конкурентные назначения и одобрения заявок. Заявки подключения этим endpoint не рассматриваются.

## Общая ссылка и заявки сотрудников

Только `super_admin` (без собственного membership):

- `GET /super-admin/clinics/{clinic_id}/join-link` → active без raw token.
- `POST .../join-link` → url и active=true; создаёт/перевыпускает ссылку, отключая прежнюю. URL доступен только в этом ответе; сервер хранит хэш.
- `DELETE .../join-link` отключает ссылку. История заявок и memberships сохраняется.
- `GET /super-admin/join-requests` → items/total; фильтры clinic_id, status (по умолчанию pending), page (1), page_size (50, максимум 100).
- `POST /super-admin/join-requests/{id}/approve|reject` → рассмотренная заявка. Повтор того же решения идемпотентен, противоположное решение → `409`.

При одобрении блокируются клиника, пользователь и заявка; активное членство другой/этой клиники исключает повторное создание. Врач занимает слот с учётом действующих email-приглашений; при превышении лимита заявка остаётся pending. Оператор получает только `is_operator`, врач — `is_doctor` и выбранные специализации; прав администратора заявка не выдаёт. Истёкшая подписка/удалённая клиника запрещает новую ссылку, заявку и одобрение; просмотр статуса и отказ доступны.
