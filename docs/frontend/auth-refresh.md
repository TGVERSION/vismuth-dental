# Frontend: refresh token (httpOnly cookie)

Backend уже выдаёт opaque refresh в **httpOnly** cookie и access JWT в JSON.  
Этот документ — чеклист для фронтенда. Код backend: [`../contracts/auth.md`](../contracts/auth.md).

Браузер ходит в API через Next rewrite `/api/main/*` → backend (same-origin). CORS на backend не нужен.

## Модель сессии

| Что | Где |
|-----|-----|
| `access_token` | memory / Zustand + `localStorage` (как сейчас) |
| `refresh_token` | **только** httpOnly cookie — JS **не** читает и **не** кладёт в store |
| `user` | store, как сейчас |

В ответах login / confirm / invite accept / refresh поле `refresh_token` **отсутствует**. Cookie ставит сервер (`Set-Cookie`).

Имя cookie по умолчанию: `refresh_token` (env `REFRESH_COOKIE_NAME`).

## Обязательные изменения клиента

### 1. Credentials на все запросы к `/api/main`

Иначе браузер не отправит refresh cookie.

- Axios: `withCredentials: true` на инстансе `base-client` (auth-клиент)
- fetch: `credentials: 'include'`

Публичные запросы без сессии (анкета пациента и т.п.) можно оставить без credentials, если они не должны слать cookie.

### 2. Login / confirm / invite accept

Без изменений по JSON:

1. Взять `access_token` (+ `user`) из body
2. Сохранить в auth store
3. Cookie refresh появится сама — ничего не парсить из `Set-Cookie`

### 3. Interceptor на 401 → refresh → retry

Текущее поведение «401 → clearAuth» заменить на:

1. Если запрос уже был retry после refresh — не повторять, `clearAuth` → `/login`
2. Иначе один раз `POST /api/main/auth/refresh` с credentials, **без** Bearer (или со старым — не важно)
3. Успех: сохранить новый `access_token` (+ при желании `user`) → повторить исходный запрос с новым Bearer
4. Провал refresh (`401`): `clearAuth` → `/login`

Не вызывать refresh для самого `/auth/refresh` и `/auth/login` (избежать циклов).

Параллельные 401: один in-flight refresh, остальные ждут его результат (очередь / Promise), иначе rotation + reuse detection отобьёт сессию.

### 4. Logout

1. `POST /api/main/auth/logout` с credentials (Bearer не обязателен — работает по cookie)
2. Очистить access/user в store
3. Не пытаться «удалить cookie» из JS — сервер шлёт clear

### 5. Чего не делать

- Не класть refresh в `localStorage` / sessionStorage / Zustand
- Не слать refresh в body или `Authorization`
- Не полагаться на TTL access 60 мин — default теперь **15** минут (`ACCESS_TOKEN_EXPIRE_MINUTES`)

## Проверка вручную

1. Login → в Application → Cookies есть `refresh_token` (HttpOnly)
2. Удалить/подменить access в store → следующий API-запрос: 401 → refresh → новый access → успех
3. Logout → cookie исчезла; повторный refresh → 401
4. DevTools: refresh **не** виден в JS (`document.cookie`)

## Smoke (backend напрямую)

При тестах на `http://localhost:8000` cookie jar нужен (`requests.Session` уже в smoke `_client.py`). Helper: `refresh(ctx)`.
