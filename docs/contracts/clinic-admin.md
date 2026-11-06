# Админка клиники

Код: `routers/clinic_admin.py`, `services/clinic_members.py`.  
Доступ: `super_admin` **или** активный membership с `is_clinic_admin` (`deps.require_clinic_admin`).

## GET /specializations

- **Auth:** JWT
- **Назначение:** справочник `ref_specialization` для выбора при invite/редактировании
- **Код:** `list_specializations`

## GET /me/clinic

- **Auth:** JWT
- **Назначение:** клиника текущего пользователя: ссылки клиники и врача, роли membership, специализации, `questionnaire_kind` (`general` | `dental` | `mixed`). Фронт показывает раздел «Анкеты для стоматологии» (`/registry`) админу клиники с `dental` или `mixed`
- **Код:** `my_clinic`

## GET /clinics/{clinic_id}

- **Auth:** clinic admin / super_admin
- **Назначение:** карточка клиники для админки (без лимита/даты доступа — они в super-admin)
- **Код:** `get_clinic_admin`

## PATCH /clinics/{clinic_id}

- **Auth:** clinic admin / super_admin
- **Назначение:** name, phone, logo_url, brand_color
- **Код:** `patch_clinic_admin`

## GET /clinics/{clinic_id}/members

- **Auth:** clinic admin / super_admin
- **Назначение:** memberships (active/deactivated) + pending invitations (invited)
- **Код:** `list_members`

## POST /clinics/{clinic_id}/invitations

- **Auth:** clinic admin / super_admin
- **Назначение:** пригласить врача/админа; для врача обязательны `specialization_ids`; проверка лимита врачей
- **Код:** `invite_member`

## POST /clinics/{clinic_id}/invitations/{id}/resend

- **Auth:** clinic admin / super_admin
- **Код:** `resend_member_invitation`

## PATCH /clinics/{clinic_id}/members/{id}

- **Auth:** clinic admin / super_admin
- **Назначение:** ФИО, фото, роли, специализации
- **Код:** `patch_member`

## POST /clinics/{clinic_id}/members/{id}/deactivate

- **Auth:** clinic admin / super_admin
- **Поведение:** membership `deactivated`, `user.is_active=false`, место в лимите освобождается; публичная ссылка врача → заглушка
- **Код:** `deactivate_member`

## GET /clinics/{clinic_id}/statistics

- **Auth:** clinic admin / super_admin
- **Назначение:** статистика анкет клиники за период
- **Поведение:** query `period=week|month` **или** пара `from`/`to` (`date`, inclusive); default `month`. Вместе period и from/to → `422`. Заполненные — по `completed_at`; брошенные — по `last_activity_at`. Разрезы: всего / primary-repeat / протоколы / по врачам / брошено по шагу (`ai_clarify` → `ai_question_n`)
- **Ответ (смысл):** скаляры + `by_doctor[]` + `abandoned_by_step[]` (только count > 0)
- **Frontend:** таблица «Статистика» в админке клиники
- **Код:** `clinic_admin.py` → `get_clinic_statistics`

Подробнее: [questionnaire-statistics.md](questionnaire-statistics.md).

## Пациентские ссылки и оператор

`GET /me/clinic` и строки участников возвращают `is_operator` (по умолчанию false). Флаг не назначается через старые email-приглашения или PATCH участников; одобрение заявки выполняет super_admin. Редактирование профиля существующего operator-only участника сохраняет его membership.

`GET /clinics/{clinic_id}/patient-links`: super_admin либо активный администратор/оператор своей неудалённой клиники. Возвращает название/ID клиники, `clinic_public_url` и `doctors` (ФИО, membership_id, public_url, специализации). Для dental общая ссылка null и врачи не возвращаются. Для general/mixed включены только активные неудалённые врачи с непустыми специализациями и публичным slug. Эти данные не дают прав управления; запуск анкеты проверяет доступность действующим публичным resolver.
