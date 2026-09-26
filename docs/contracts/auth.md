# Auth — `/auth`

> **Breaking (роли):** в `user` ответа login/confirm поле `role` — новые коды (`admin`, …); добавлено `role_name_ru`. Старые `administrator` / `head_of_department` не используются.

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
- **Назначение:** подтвердить код → создать user + JWT
- **Поведение:** проверяет pending / expiry / attempts / code; создаёт `service_user`, роль из `DEFAULT_USER_ROLE`, `user_settings`; удаляет pending. `400` / `429` / `409`
- **Ответ (смысл):** `access_token`, `user` с `id`, `login`, `role`, `role_name_ru`
- **Frontend:** сохранить token; подтянуть профиль (`GET /service_user`) при необходимости
- **Код:** `register_confirm`

## POST /auth/login

- **Auth:** none
- **Назначение:** вход по email + пароль
- **Поведение:** `401` неверные credentials / deleted; `403` inactive
- **Ответ (смысл):** `access_token`, `user` (`role`, `role_name_ru`)
- **Frontend:** persist token + user; дальше защищённые страницы
- **Код:** `login`

## POST /auth/logout

- **Auth:** JWT
- **Назначение:** клиентский logout
- **Поведение:** сервер токен не отзывает; ответ `{ detail: "logged_out" }`
- **Frontend:** удалить token из storage / store
- **Код:** `logout`

## GET /auth/invitations/{token}

- **Auth:** none
- **Назначение:** превью приглашения по raw token из ссылки
- **Поведение:** `404` нет/used/deleted; `410` expired; иначе email, clinic_name, роли, expires_at
- **Frontend:** страница `/invite/accept` до формы пароля
- **Код:** `preview_invitation`

## POST /auth/invitations/accept

- **Auth:** none
- **Назначение:** принять invite → создать user + membership + JWT
- **Поведение:** проверяет token / expiry / clinic; `409` если email уже занят; создаёт `service_user` (глобальная роль `doctor`, копирует first/last/**middle_name**), `user_settings`, `clinic_membership` (флаги и `photo_url` из invite, status `active`, генерирует **`public_slug`**); копирует специализации из `clinic_invitation_specialization` → `clinic_membership_specialization`; помечает invite `used_at`
- **Ответ (смысл):** как login — `access_token` + `user`
- **Frontend:** форма пароля после превью; persist token
- **Код:** `accept_invitation`
