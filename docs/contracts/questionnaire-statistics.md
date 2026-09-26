# Статистика анкет

Код: [`backend/app/services/questionnaire_statistics.py`](../../backend/app/services/questionnaire_statistics.py).  
Routers: `clinic_admin.py` → `GET /clinics/{clinic_id}/statistics`; `super_admin/statistics.py` → `GET /super-admin/statistics`.

Расход токенов GigaChat в ответы **не** входит (задача B4).

## Период

| Query | Смысл |
|-------|--------|
| `period=week` | с понедельника 00:00 UTC текущей недели до now |
| `period=month` | с 1-го числа 00:00 UTC текущего месяца до now (default, если ничего не передано) |
| `from` + `to` | календарные даты inclusive, окно `[from 00:00 UTC, to+1day 00:00 UTC)` |

`period` вместе с `from`/`to` → `422`. Только один из `from`/`to` → `422`.

## Метрики одной клиники

| Поле | Смысл |
|------|--------|
| `completed_total` | `status=completed`, `completed_at` в окне |
| `primary_count` / `repeat_count` | по `visit_type` среди заполненных |
| `protocols_total` | заполненные с `protocol_id IS NOT NULL` |
| `by_doctor[]` | разрез по `doctor_membership_id` (+ ФИО); `null` — без врача |
| `abandoned_by_step[]` | `status=abandoned`, `last_activity_at` в окне; для `ai_clarify` — `ai_question_n` |

Шаги брошенных (порядок): `choose_doctor`, `choose_specialization`, `visit_type`, `complaint`, `ai_clarify` (N), `medications`, `chronic`, `allergy`, `repeat_change`, `repeat_compliance`, `repeat_side_effects`, `patient_info`. Нулевые шаги не отдаются.

## GET /clinics/{clinic_id}/statistics

- **Auth:** `require_clinic_admin` (clinic admin или super_admin)
- **Назначение:** таблица статистики своей / выбранной клиники
- **Код:** `get_clinic_statistics`

## GET /super-admin/statistics

- **Auth:** только `super_admin`
- **Назначение:** строки по всем неудалённым клиникам + `summary` (суммы скаляров и слияние `abandoned_by_step`; без `by_doctor`)
- **Поведение:** клиники без анкет в периоде — нулевые скаляры и пустые массивы
- **Frontend:** сводная таблица супер-админки
- **Код:** `get_super_admin_statistics`

## Список клиник

В `GET /super-admin/clinics` и `GET /super-admin/clinics/{id}`: `questionnaires_completed_month` — число заполненных за текущий календарный месяц UTC.
