# ДМС: проверка назначений по КР

Backend proxy: resolve каталога → скачать PDF из S3 → multipart в ml-service.

Код: `backend/app/routers/check_dms.py`, `services/clinrec_ml.request_check_dms`, `services/s3.get_object_bytes`.

Каталог КР: [clinrec.md](clinrec.md). Legacy проверка протокола: [ml.md](ml.md) → `/ml_clinrec_check`.

## POST /check_dms

- **Auth:** JWT + проверка подписки (`subscription_expired` → `503`)
- **Назначение:** разметить назначения врача на «лишние» относительно клинических рекомендаций по МКБ
- **Request (JSON для UI):**
  - `mkb` — код или «код + название» (resolve guideline)
  - `appointments` — свободный текст назначений (max 4000)
- **Поведение:**
  1. resolve guideline среди статусов `uploaded` \| `active` \| `failed` (нужен PDF в S3, не Chroma-index);
  2. `get_object` из S3; не PDF → `422 pdf_invalid`; нет объекта → `422 s3_object_not_found`;
  3. `POST {ML}/check_dms` **multipart**: `file` (PDF) + form `mkb`, `appointments`;
  4. в ответ добавляются `guideline_code` / `guideline_title`.
- **Ответ:** `{ appointments: [{ text, unnecessary }], fragments: [{ section, text }], guideline_code?, guideline_title? }`
- **Ошибки:** нет КР → `422 guideline_not_found`; upstream ML → `502` / `504`
- **Frontend:** после выбора диагноза и заполнения назначений
- **Код:** `check_dms`

> ML на ветке PL-315 пока может принимать JSON `pdf_url`; целевой контракт — multipart. Backend уже шлёт файл.
