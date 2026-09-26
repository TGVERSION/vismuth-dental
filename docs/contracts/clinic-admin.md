# Админка клиники

Код: `routers/clinic_admin.py`, `services/clinic_members.py`.  
Доступ: `super_admin` **или** активный membership с `is_clinic_admin` (`deps.require_clinic_admin`).

## GET /specializations

- **Auth:** JWT
- **Назначение:** справочник `ref_specialization` для выбора при invite/редактировании
- **Код:** `list_specializations`

## GET /me/clinic

- **Auth:** JWT
- **Назначение:** клиника текущего пользователя: ссылки клиники и врача, роли membership, специализации
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
