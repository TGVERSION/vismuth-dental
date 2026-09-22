# Шаблон секции endpoint

Копировать в файлы `contracts/*.md`. Писать по-русски, коротко. Не копировать полный OpenAPI.

```markdown
## METHOD /path

- **Auth:** none | JWT | privileged (`super_admin` \| `admin`) | JWT + access-rule
- **Назначение:** 1–2 предложения
- **Поведение:** шаги, side effects, важные коды ошибок
- **Ответ (смысл):** что важно UI (без полного списка полей)
- **Frontend:** типичное использование (store, dropdown, список)
- **Код:** `backend/app/routers/….py` → `handler_name`
```

При breaking change — вверху файла контракта блок:

```markdown
> **Breaking:** было `…` → стало `…` (дата / PR)
```
