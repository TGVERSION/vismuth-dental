# Роли и права доступа

## Модель данных

```text
service_user 1 ── 1 service_user_role N ── 1 role
```

- Таблица `role`: `id`, `name` (код), `name_ru` (подпись).
- Таблица `service_user_role`: PK = `user_id` → **пока одна роль на пользователя**.
- Колонки `service_user.role` больше нет (миграция `0006_roles`).

Код: `backend/app/models/role.py`, `backend/app/models/service_user.py`, `backend/app/services/roles.py`.

## Справочник ролей

| `name` | `name_ru` | Privileged сейчас |
|--------|-----------|-------------------|
| `super_admin` | Супер-админ | да (как бывший `administrator`) |
| `admin` | Админ | да (замена `administrator`) |
| `doctor` | Врач | нет |
| `patient` | Пациент | нет (права позже) |

`PRIVILEGED_ROLE_NAMES = { super_admin, admin }`.

`super_admin` — платформенная роль поставщика сервиса. Endpoint'ы `/super-admin/*` доступны **только** ей (`require_roles("super_admin")`).  
`admin` остаётся privileged для legacy CRUD users / general templates, но **не** видит супер-админку клиник.

## Клиника: роли через membership

Права внутри клиники **не** кодируются глобальной ролью `admin`:

- таблица `clinic_membership`: флаги `is_clinic_admin`, `is_doctor` (можно оба);
- приглашённый через invite получает глобальную роль `doctor` + membership с нужными флагами;
- API администратора клиники: `deps.require_clinic_admin` — `super_admin` **или** активный membership с `is_clinic_admin` (`/clinics/{id}/*`);
- раздел анкет врача: активный membership с `is_doctor` (`/questionnaires`).

Специализации врача: M2M `clinic_membership_specialization` ↔ `ref_specialization`.  
Публичная ссылка врача: `clinic_membership.public_slug`.

## Миграция старых значений

| Было | Стало |
|------|--------|
| `administrator` | `admin` |
| `head_of_department` | `admin` |
| `doctor` | `doctor` |
| прочее | `admin` |

## API для UI

- У пользователя в ответах: `role` + `role_name_ru`.
- Справочник: `GET /roles` → список `{ name, name_ru }` (любой JWT).
- Назначение роли: privileged `PUT`/`PATCH /service_user/{id}` с полем `role` (код).
- Регистрация: роль из `DEFAULT_USER_ROLE` (обычно `doctor`).

## Frontend (рекомендации)

У супер-администратора названия меню анкет совпадают с общими: «Анкеты для стоматологии» и «Анкеты для врачей», дополнительно доступны «Протоколы» и «Заявки» со счётчиком. Его пункт «Анкеты для врачей» ведёт в общий обзор завершённых анкет (`/completed-questionnaires`), без собственного членства; обычного врача этот пункт ведёт в `/questionnaires`. Настройки пользователей представлены раскрывающимися карточками с ФИО, статусом и встроенной формой членства. Внешний вид не заменяет серверную проверку доступа.

В навигации вкладка «Протоколы» показывается только `super_admin`, включая период загрузки пользователя (без известной роли вкладка скрыта). Это временное ограничение видимости вкладки; API протоколов и создание протокола из анкеты сохраняют существующие права. «Анкеты для врачей» — `/questionnaires`; «Анкеты для стоматологии» — `/registry`, для администратора клиники с направлением `dental` или `mixed`.

1. Не хардкодить список ролей и подписи — брать из `GET /roles`.
2. В списках пользователей показывать `role_name_ru`, в PATCH отправлять `role` (код).
3. Не строить route-guards на frontend как единственную защиту: проверка на backend. UI может скрывать admin-действия, опираясь на `role` текущего user.

## Где проверяется privileged

| Место | Правило |
|-------|---------|
| `deps.require_privileged` | CRUD service_user |
| `user_settings._ensure_access` | свой user **или** privileged |
| `protocol_templates` | `privacy=general` create/update/delete |
| `deps.require_roles("super_admin")` | `/super-admin/clinics*`, `/super-admin/statistics`, запись `/clinrec/guidelines*` (POST/PATCH/DELETE/index) |
| `deps.require_clinic_admin` | `/clinics/{clinic_id}*` |
| doctor membership | `/questionnaires*` |

## Оператор контакт-центра

Супер-администратор назначает/меняет клинику и роль членства через `/super-admin/users/{user_id}/membership`; роли для интерфейса отдаёт `/super-admin/user-membership-roles`. Рабочая платформенная роль должна быть `doctor`; `admin`/`patient` требуют отдельной явной смены платформенной роли, `super_admin` не назначается в клинику этим способом. Перевод не повышает платформенные права. Пустая клиника снимает активное членство и устанавливает `clinic_join_restricted=true`, поэтому старые access-токены также перестают открывать рабочие API. Новое назначение снимает этот барьер.

Перевод сохраняет прежнее членство деактивированным: исторические анкеты остаются в исходной клинике с прежним `doctor_membership_id`. Новая клиника не получает старые анкеты. В целевой клинике действуют обычные проверки подписки, специализаций и лимита врачей. Оператор назначается как отдельная исключительная роль членства (`is_operator=true`, остальные флаги false).

`clinic_membership.is_operator` — отдельное право, исходно false, назначается одобрением заявки super_admin. Оператор своей активной неудалённой клиники читает общую/врачебные пациентские ссылки, завершённые анкеты трёх видов и выполняет существующие действия dental-регистратуры (включая печать и отметки). Управление клиникой, участниками, подпиской и заявки других сотрудников недоступны. `require_clinic_registry` проверяет super_admin либо active membership с is_clinic_admin/is_operator; `require_clinic_admin` не расширяется.

`/super-admin/questionnaires` доступен только super_admin, без собственного membership, в том числе для исторических анкет удалённых/заблокированных клиник. Legacy admin и остальные роли не получают платформенного обзора. Operator-only membership не публикуется как врач и не получает врачебную ссылку.

Рабочие врачебные API протоколов, шаблонов, структур и ML/DMS используют отдельную проверку клинического доступа: operator-only пользователь без самостоятельных врачебных/платформенных прав не получает эти помощники. Ожидающая подтверждения новая учётная запись не допускается к рабочим API; чтение собственного профиля и статуса заявки остаётся доступно через проверку личности.
