# Подключение клиник и доступ супер-администратора — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать утверждённую спецификацию `docs/superpowers/specs/2026-11-06-clinic-self-join-and-super-admin-design.md`: заявки сотрудников по общей ссылке с подтверждением только super_admin, оператор с ограниченными правами, пациентские ссылки и заполненные анкеты всех клиник.

**Architecture:** Отдельные сервисы onboarding и чтения анкет платформы, действующие membership и auth расширяются совместимо. Все права проверяются backend. Новые UI-потоки используют общий API-клиент; старые email-приглашения и пациентские сценарии сохраняются.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL/Alembic, Pydantic, Next.js/React, pytest и Vitest.

## 1. Подготовка и контракты

- [ ] Создать рабочую ветку от текущей чистой копии; сохранить независимость от установленного сервера.
- [ ] Восстановить доступный Python 3.12 для запуска backend-тестов; использовать отдельный каталог инструментов вне отслеживаемых файлов.
- [ ] Зафиксировать взаимодействие: `/clinic-join/{token}` UI; `/auth/clinic-join/{token}` preview, `/auth/clinic-join/register` и `/confirm` для нового сотрудника, `/clinic-join/requests` JWT POST и `/clinic-join/me` GET; `/super-admin/clinics/{id}/join-link` GET/POST/DELETE; `/super-admin/join-requests` GET и `/{id}/approve|reject` POST. Серверный справочник роли operator/doctor в preview. Поля request: id, clinic_id/name, user_id, email, first/last/middle_name, requested_role, specialization_ids, status, created_at, reviewed_at.
- [ ] Чтение анкет платформы: `/super-admin/questionnaires` GET с clinic_id/kind/name/date_from/date_to/page/page_size; ответ items/total/page/page_size. `/{id}` GET: существующая DoctorQuestionnaireDetail + clinic_id/clinic_name/kind. Для оператора `/clinics/{id}/completed-questionnaires` и `/{id}` с теми же фильтрами.

## 2. Backend подключения сотрудников

Files: `backend/app/models/clinic_join.py`, `schemas/clinic_join.py`, `services/clinic_join.py`, `routers/clinic_join.py`, `routers/super_admin/clinic_join.py`, `models/{clinic_membership,registration_pending,service_user}.py`, `deps.py`, `schemas/clinic_admin.py`, `routers/clinic_admin.py`, `models/__init__.py`, `main.py`, новая Alembic-миграция.

- [ ] Сначала добавить поведенческие тесты `backend/tests/test_clinic_join.py`: разные сотрудники одной ссылки → pending; чужое решение →403; подтверждение → membership; отказ/дубликат/лимит/повтор/гонки/отозванная ссылка; ожидание → запрет рабочего API. Запустить и убедиться в ожидаемом падении.
- [ ] Добавить `is_operator` и признак ограниченной новой учётной записи без автоматического расширения старых прав. Новые user ограничены до одобрения, существующие права при подаче заявки не отзываются.
- [ ] Хранить токены ссылок хэшированными; пересоздание отзывает старый token, GET возвращает состояние без raw URL. Контекст подтверждения email хранится в registration_pending, не в клиентском URL. Ссылка и доступность клиники перепроверяются при confirm и создании заявки.
- [ ] Подтверждение транзакционно блокирует клинику и заявку, проверяет активное членство другой клиники и лимит врача, создаёт membership и специализации и снимает ограничение нового пользователя; отклонение оставляет данные закрытыми. Повтор того же решения возвращает прежний результат, противоположное решение —409.
- [ ] Прогнать новые тесты, миграционный smoke и старые auth/clinic tests; исправить ошибки. Обновить контракты auth/super-admin-clinics и internals.

## 3. Backend анкет и прав оператора

Files: `backend/app/services/questionnaire_read.py`, `routers/super_admin/questionnaires.py`, `routers/clinic_completed_questionnaires.py`, `deps.py` (согласовать с задачей 2), `routers/clinic_questionnaires.py`, `schemas/questionnaire.py`, `schemas/clinic_admin.py`, `main.py` (регистрацию выполняет координатор).

- [ ] Написать `backend/tests/test_super_admin_questionnaires.py` и `test_operator_access.py`: доступ платформы без membership, три вида, клиника/ФИО/диапазон/пагинация; operator только своей клиники, без clinic-admin функций. Проверить ожидаемые падения до реализации.
- [ ] Реализовать повторно используемое чтение completed с сохранёнными ответами/сводками. Ограничить сортировку и размер страницы, параметризовать запросы SQLAlchemy, исключить скрытый фильтр сегодняшней даты.
- [ ] Добавить точечную `require_clinic_registry` (super_admin, admin клиники, operator) для dental-функций. Общий require_clinic_admin не расширять. Обеспечить чтение общих/гастро-анкет operator своей клиники.
- [ ] Проверить старые dental/doctor права и новые негативные сценарии. Обновить contracts questionnaire/clinic-questionnaires и roles-and-permissions.

## 4. Frontend

Files: `frontend/src/api/clinic-join.ts`, `api/platform-questionnaires.ts` (отдельные модули с существующим BaseApiClient), `app/clinic-join/[token]/page.tsx`, `components/clinic-join/*`, `components/settings/clinics/ClinicJoinLink.tsx`, `components/settings/JoinRequests.tsx`, `components/platform-questionnaires/*`, `components/registry/RegistryScreen.tsx`, `components/AppNav.tsx`, `lib/app-nav.ts`, `app/(app)/layout.tsx` и интеграция settings.

- [ ] Сначала тесты логики ролей/ожидания/фильтров/состояний `lib/clinic-join.test.ts`, `platform-questionnaires.test.ts`, расширение app-nav tests; Vitest должен показать отсутствие новой логики.
- [ ] Реализовать preview общей ссылки → регистрация с email-кодом или вход существующего → pending → обновление статуса. Серверные ошибки отображаются в форме, повторная отправка блокируется во время запроса. На logout личные сведения очищаются.
- [ ] Карточка клиники: общая ссылка подключения (копирование при выдаче, отключение, перевыпуск), существующие пациентские ссылки, переход в dental-регистратуру нужной клиники. В settings/platform UI список pending с числом, фильтром, approve/reject, согласованным обновлением.
- [ ] Супер-администратору — все заполненные анкеты с фильтрами и деталями; выбор клиники в dental-регистратуре без своего membership. Оператору — своя клиника, её ссылки и заполненные анкеты, dental-печать, без настроек клиники и врачебных помощников. Смена clinic/filter не показывает карточку другого контекста; защита от устаревших ответов.
- [ ] Vitest, TypeScript, lint, build. Моки использовать только для отдельного browser QA, не включать в рабочую сборку.

## 5. Интеграция и ревью

- [ ] Координатор проверяет схему API и права между задачами; регистрирует маршруты, адаптирует миграции и проверяет downgrade без потери решений.
- [ ] Полный backend pytest (включая новые негативные проверки), Vitest, tsc, lint, production build. Команды: `python -m pytest tests -q -p no:cacheprovider`, `vitest run --no-cache`, `tsc --noEmit`, `eslint .`, `next build`.
- [ ] Самостоятельное ревью по каждому пункту спецификации, затем независимое ревью безопасности/качества. Исправить существенные замечания и повторить затронутые проверки.
- [ ] Браузерная проверка супер-админа без своей клиники, заявителя, оператора и врача с синтетическими данными; PostgreSQL upgrade/downgrade/upgrade на отдельной БД, если доступно локальное окружение.

## 6. Завершение

- [ ] Сохранить проверенные изменения и отчёт о проверках. Сверить git diff --check и отсутствие секретов.
- [ ] Отдельно фиксировать факты отправки на GitHub и развёртывания. Реализация не считается опубликованной на сервере без реального выпуска и проверки.
