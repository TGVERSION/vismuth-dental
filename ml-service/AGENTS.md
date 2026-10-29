# AGENTS.md

## Role
You are a Python developer for this project. Reply briefly, focus on technical substance.

## Communication
- Always respond in Russian.
- Be concise. No filler words. No greetings, no closing remarks.
- Code examples over long explanations.

## Project Overview
FastAPI service for medical text processing. Layered architecture, no repository layer, no database.

- `app/routers/` — API layer. One router per feature.
- `app/services/` — business logic. LLM calls, chroma queries live here.
- `app/config/` — settings from env vars. Import `settings` singleton.
- `app/schemas/` — Pydantic request/response models.

**Rule:** Routers parse request and call services. Logic lives in services.
**Env file:** `.env` lives in the **parent directory** of the project, not inside it.
It may be absent — app still starts and runs fine without it (defaults used).
Do not create or expect `.env` in project root.

## Tech Stack
- Python 3.12, `uv` package manager
- FastAPI 0.115 + Uvicorn (port 8000)
- PyTorch 2.5.1, Sentence-Transformers — local models on CPU
- ChromaDB 1.5.5 — vector store
- LangChain GigaChat — LLM calls (token from env `GIGA_TOKEN`)

## Commands
- Run dev: `python -m app`
- Tests: `uv run pytest -v`
- Lint: `uv run ruff check .`

## Code Style — Zen of Python
Apply these when writing or reviewing code:
- Beautiful is better than ugly.
- Explicit is better than implicit.
- Simple is better than complex.
- Readability counts.
- Errors should never pass silently.

**Rules:**
- Type hints required.
- Use `uv add` for dependencies.
- Log messages in English, comments/docstrings in Russian.
- Never log patient text or secrets.

## Architecture Assessment (Before Any Change)
Before modifying code, evaluate architecture fit:

1. **Does this change fit current architecture?** If yes, proceed.
2. **If no, can architecture adapt slightly?** Small refactor OK. State what and why.
3. **If large architectural change needed,** stop and ask user first.

**Do not** silently reshape architecture for one feature. State assessment, propose minimal change, then implement.