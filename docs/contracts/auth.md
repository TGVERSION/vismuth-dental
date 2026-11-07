# Auth — `/auth`

> **Breaking (роли):** в `user` ответа login/confirm поле `role` — новые коды (`admin`, …); добавлено `role_name_ru`. Старые `administrator` / `head_of_department` не используются.
>
> **Refresh:** access JWT в JSON; opaque refresh — только httpOnly cookie (не в body). Инструкция для frontend: [`../frontend/auth-refresh.md`](../frontend/auth-refresh.md).

Код: [`backend/app/routers/auth.py`](../../backend/app/routers/auth.py).

## POST /auth/register

- **Auth:** none
- **Назначение:** заявка на регистрацию; код на email
- **Поведение:** нормализует login (email lower); `409` если user уже есть; upsert `registration_pending`; шлёт код. `503` при сбое SMTP; `500` если нет таблицы / ошибка БД
- **Ответ (смысл):** `{ detail: "code_sent" }`
- **Frontend:** форма регистрации → экран ввода кода
- **Код:** `register`

## POST /auth/register/confirm

- **Auth:** none
- **Назначение:** подтвердить код → создать user + access JWT + refresh cookie
- **Поведение:** проверяет pending / expiry / attempts / code; создаёт `service_user`, роль из `DEFAULT_USER_ROLE`, `user_settings`; удаляет pending; выдаёт сессию. `400` / `429` / `409`
- **Ответ (смысл):** `access_token`, `user` с `id`, `login`, `role`, `role_name_ru`; `Set-Cookie: refresh_token=…` (httpOnly)
- **Frontend:** сохранить access; cookie ставит браузер; подтянуть профиль (`GET /service_user`) при необходимости
- **Код:** `register_confirm`

## POST /auth/login

- **Auth:** none
- **Назначение:** вход по email + пароль
- **Поведение:** `401` неверные credentials / deleted; `403` inactive; при успехе — access + refresh cookie
- **Ответ (смысл):** `access_token`, `user` (`role`, `role_name_ru`); `Set-Cookie` refresh
- **Frontend:** persist access + user; `withCredentials` / credentials include
- **Код:** `login`

## POST /auth/refresh

- **Auth:** refresh cookie (без Bearer)
- **Назначение:** ротация refresh + новый access JWT
- **Поведение:** читает cookie → проверяет hash в БД → revoke старого + новый refresh; reuse revoked cookie → revoke всех сессий user → `401`. `401` если cookie нет / expired / user inactive
- **Ответ (смысл):** как login — `access_token` + `user` + новый `Set-Cookie`
- **Frontend:** на 401 API один раз вызвать refresh, обновить access, retry; при провале → login
- **Код:** `refresh`

## POST /auth/logout

- **Auth:** none (достаточно refresh cookie; Bearer не обязателен)
- **Назначение:** завершить сессию устройства
- **Поведение:** revoke текущий refresh в БД (если cookie есть); `Clear-Cookie`; работает при истёкшем access
- **Frontend:** вызвать с credentials, затем очистить access из store
- **Код:** `logout`

## GET /auth/invitations/{token}

- **Auth:** none
- **Назначение:** превью приглашения по raw token из ссылки
- **Поведение:** `404` нет/used/deleted; `410` expired; иначе email, clinic_name, роли, expires_at
- **Frontend:** страница `/invite/accept` до формы пароля
- **Код:** `preview_invitation`

## POST /auth/invitations/accept

- **Auth:** none
- **Назначение:** принять invite → создать user + membership + сессия
- **Поведение:** проверяет token / expiry / clinic; `409` если email уже занят; создаёт `service_user` (глобальная роль `doctor`, копирует first/last/**middle_name**), `user_settings`, `clinic_membership` (флаги и `photo_url` из invite, status `active`, генерирует **`public_slug`**); копирует специализации из `clinic_invitation_specialization` → `clinic_membership_specialization`; помечает invite `used_at`; выдаёт access + refresh cookie
- **Ответ (смысл):** как login — `access_token` + `user` + `Set-Cookie`
- **Frontend:** форма пароля после превью; persist access
- **Код:** `accept_invitation`

## Подключение сотрудника по общей ссылке

- `GET /auth/clinic-join/{token}` — публичный предпросмотр доступной клиники, четыре единые роли из GET /clinic-roles с подписями и справочник специализаций. Клиент не выбирает clinic_id.
- `POST /auth/clinic-join/register` — email, пароль, ФИО, token, requested_role и specialization_ids. Для врача и админа-врача нужна хотя бы одна существующая специализация, остальным специализации запрещены. Все выбранные права, включая админа, ожидают подтверждения супер-администратором. Занятый email → `409`, существующий пользователь должен войти.
- `POST /auth/clinic-join/confirm` — login и код. Перепроверяет ссылку и подписку, создаёт ограниченную учётную запись и заявку `pending`; возвращает обычные access JWT и refresh cookie. Обычный `/auth/register/confirm` такой контекст не принимает.
- `POST /clinic-join/requests` — JWT, token и выбор роли/специализаций для существующего пользователя; повторная pending-заявка или активное членство в этой же клинике → `409`; членство в другой клинике не мешает подаче, но блокирует одобрение без отдельного решения о переводе. Ранее выданные права не отзываются.
- `GET /clinic-join/me` — JWT; restricted и до 100 последних собственных заявок с клиникой, ролью и решением. Чужие заявки недоступны.

Новая учётная запись до одобрения и после отказа получает `403` от рабочих API. Доступны вход/refresh/logout, собственный профиль и статус. Одобрение снимает ограничение без замены JWT; после отказа можно подать новую заявку через действующую ссылку. Оператор получает доступ регистратуры своей клиники, но не врачебных инструментов и управления клиникой.

Публичные операции ограничены Redis: preview — 60 запросов/минуту на IP; регистрация, подтверждение и отправка — 10/15 минут на IP/аккаунт, регистрация дополнительно на email. При недоступном Redis — `503`. Код сохраняет TTL и число попыток действующего auth.

Истёкшая незавершённая регистрация по ссылке не блокирует новую обычную регистрацию: `/auth/register` сбрасывает её старый контекст и выдаёт новый код. Действующий контекст общей ссылки по-прежнему требует `/auth/clinic-join/confirm`.
