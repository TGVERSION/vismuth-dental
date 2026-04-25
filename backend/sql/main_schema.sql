-- Основная схема БД для сервиса поддержки принятия врачебных решений
-- PostgreSQL

-- Расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- Таблицы универсальных справочников
-- =========================================

-- Реестр справочников: связь OID с названием таблицы в схеме
CREATE TABLE IF NOT EXISTS dictionary (
    id BIGSERIAL PRIMARY KEY,
    oid VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE dictionary IS 'Связь OID справочника с названием таблицы в схеме';

-- Заполнение реестра: OID -> таблица справочника
INSERT INTO dictionary (oid, name) VALUES
    ('1.2.643.5.1.13.13.11.1006', 'ref_patient_condition'),
    ('1.2.643.5.1.13.13.11.1473', 'ref_pathology'),
    ('1.2.643.5.1.13.13.11.1058', 'ref_bad_habits'),
    ('1.2.643.5.1.13.13.11.1064', 'ref_allergy_reaction_type'),
    ('1.2.643.5.1.13.13.11.1063', 'ref_allergy_manifestation'),
    ('1.2.643.5.1.13.13.99.2.262', 'ref_vital_parameter'),
    ('1.2.643.5.1.13.13.11.1358', 'ref_unit'),
    ('1.2.643.5.1.13.13.11.1514', 'ref_scale_type'),
    ('1.2.643.5.1.13.13.11.1515', 'ref_scale_parameter'),
    ('1.2.643.5.1.13.13.11.1077', 'ref_diagnosis_nosology_type'),
    ('1.2.643.5.1.13.13.11.1005', 'ref_mkb10'),
    ('1.2.643.5.1.13.13.99.2.795', 'ref_diagnosis_justification'),
    ('1.2.643.5.1.13.13.11.1049', 'ref_disease_character')
ON CONFLICT (oid) DO NOTHING;

-- =========================================
-- Справочники (по OID, структура как в new_tables.sql)
-- =========================================

-- 1.2.643.5.1.13.13.11.1006 — Состояние пациента
-- CSV: NAME;SCTID;SORT;SYN;ID (id из файла не трогать)
CREATE TABLE IF NOT EXISTS ref_patient_condition (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255),
    sctid VARCHAR(50),
    sort INTEGER,
    syn VARCHAR(255)
);
COMMENT ON TABLE ref_patient_condition IS 'OID: 1.2.643.5.1.13.13.11.1006. Состояние пациента';
COMMENT ON COLUMN ref_patient_condition.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1473 — Выявленные патологии
-- CSV: ID;FULLNAME;ANATOM_LOC;TYPE_PAT;METHOD;SNOMED_CT
CREATE TABLE IF NOT EXISTS ref_pathology (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    fullname VARCHAR(500),
    anatom_loc INTEGER,
    type_pat INTEGER,
    method VARCHAR(255),
    snomed_ct VARCHAR(50)
);
COMMENT ON TABLE ref_pathology IS 'OID: 1.2.643.5.1.13.13.11.1473. Выявленные патологии';
COMMENT ON COLUMN ref_pathology.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1058 — Вредные привычки и зависимости
-- CSV: NAME;REL;SCTID;SYNONYM;ID
CREATE TABLE IF NOT EXISTS ref_bad_habits (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255),
    rel BOOLEAN,
    sctid VARCHAR(50),
    synonym VARCHAR(255)
);
COMMENT ON TABLE ref_bad_habits IS 'OID: 1.2.643.5.1.13.13.11.1058. Вредные привычки и зависимости';
COMMENT ON COLUMN ref_bad_habits.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1064 — Тип реакции (аллергологический анамнез)
-- CSV: NAME;PARENT;SCTID;ID
CREATE TABLE IF NOT EXISTS ref_allergy_reaction_type (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255),
    parent INTEGER,
    sctid VARCHAR(100)
);
COMMENT ON TABLE ref_allergy_reaction_type IS 'OID: 1.2.643.5.1.13.13.11.1064. Тип реакции';
COMMENT ON COLUMN ref_allergy_reaction_type.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1063 — Клинические проявления (аллергия)
-- CSV: NAME;NAME_SYN;SCTID;ID
CREATE TABLE IF NOT EXISTS ref_allergy_manifestation (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255),
    name_syn VARCHAR(500),
    sctid VARCHAR(50)
);
COMMENT ON TABLE ref_allergy_manifestation IS 'OID: 1.2.643.5.1.13.13.11.1063. Клинические проявления';
COMMENT ON COLUMN ref_allergy_manifestation.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.99.2.262 — Код параметра (витальные параметры)
-- CSV: ID;NAME;SYNONYM;LOCALIZATION;MEASUREMENT;METHOD;UnitCode;DATA_TYPE;OID;ID_PARAMETR
CREATE TABLE IF NOT EXISTS ref_vital_parameter (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255),
    synonym VARCHAR(255),
    localization VARCHAR(255),
    measurement VARCHAR(100),
    method VARCHAR(100),
    unit_code VARCHAR(20),
    data_type VARCHAR(20),
    oid VARCHAR(100),
    id_parametr INTEGER
);
COMMENT ON TABLE ref_vital_parameter IS 'OID: 1.2.643.5.1.13.13.99.2.262. Код параметра витальных';
COMMENT ON COLUMN ref_vital_parameter.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1358 — Единицы измерения
-- CSV: ID;FULLNAME;SHORTNAME;PRINTNAME;...
CREATE TABLE IF NOT EXISTS ref_unit (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    fullname VARCHAR(255),
    shortname VARCHAR(50),
    printname VARCHAR(50),
    measurement VARCHAR(100),
    ucum VARCHAR(50),
    coefficient VARCHAR(50),
    formula TEXT,
    conversion_id INTEGER,
    conversion_name VARCHAR(100),
    okei_code VARCHAR(20),
    nsi_code_eec VARCHAR(50),
    nsi_element_code_eec VARCHAR(50)
);
COMMENT ON TABLE ref_unit IS 'OID: 1.2.643.5.1.13.13.11.1358. Единицы измерения';
COMMENT ON COLUMN ref_unit.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1514 — Тип клинической шкалы
-- CSV: ID;NAME;NAME_ENG;ABBREVIATION;...
CREATE TABLE IF NOT EXISTS ref_scale_type (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(500),
    name_eng VARCHAR(500),
    abbreviation VARCHAR(50),
    oid_parameter VARCHAR(100),
    id_parameter INTEGER,
    oid_interpretation VARCHAR(100),
    id_interpretation INTEGER,
    point_scale BOOLEAN,
    valid INTEGER,
    valid_author TEXT,
    valid_doi VARCHAR(255),
    org VARCHAR(500)
);
COMMENT ON TABLE ref_scale_type IS 'OID: 1.2.643.5.1.13.13.11.1514. Тип клинической шкалы';
COMMENT ON COLUMN ref_scale_type.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1515 — Параметр клинической шкалы (код поля: 1.2.643.5.1.13.13.99.2.166)
-- CSV: ID;PARENT_ID;NAME;VITAL_PARAMETER;POINT;ID_INTERPRETATION;GROUPING_SCALE
CREATE TABLE IF NOT EXISTS ref_scale_parameter (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    parent_id INTEGER,
    name TEXT,
    vital_parameter VARCHAR(255),
    point INTEGER,
    id_interpretation INTEGER,
    grouping_scale INTEGER
);
COMMENT ON TABLE ref_scale_parameter IS 'OID: 1.2.643.5.1.13.13.11.1515. Параметр клинической шкалы';
COMMENT ON COLUMN ref_scale_parameter.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1077 — Вид нозологической единицы диагноза
-- CSV: FULL_NAME;NAME_088_488_551;SHORT_NAME;ID
CREATE TABLE IF NOT EXISTS ref_diagnosis_nosology_type (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    full_name VARCHAR(255),
    name_088_488_551 VARCHAR(255),
    short_name VARCHAR(100)
);
COMMENT ON TABLE ref_diagnosis_nosology_type IS 'OID: 1.2.643.5.1.13.13.11.1077. Вид нозологической единицы диагноза';
COMMENT ON COLUMN ref_diagnosis_nosology_type.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1005 — Код диагноза по МКБ-10
-- CSV: ID;REC_CODE;MKB_CODE;MKB_NAME;ID_PARENT;ADDL_CODE;ACTUAL;DATE
CREATE TABLE IF NOT EXISTS ref_mkb10 (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    rec_code VARCHAR(50),
    mkb_code VARCHAR(20),
    mkb_name VARCHAR(500),
    id_parent INTEGER,
    addl_code VARCHAR(50),
    actual INTEGER,
    date_column DATE
);
COMMENT ON TABLE ref_mkb10 IS 'OID: 1.2.643.5.1.13.13.11.1005. Код диагноза по МКБ-10';
COMMENT ON COLUMN ref_mkb10.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.99.2.795 — Степень обоснованности диагноза
-- CSV: ID;ID_PARENT;NAME;SORT
CREATE TABLE IF NOT EXISTS ref_diagnosis_justification (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    id_parent INTEGER,
    name VARCHAR(255),
    sort INTEGER
);
COMMENT ON TABLE ref_diagnosis_justification IS 'OID: 1.2.643.5.1.13.13.99.2.795. Степень обоснованности диагноза';
COMMENT ON COLUMN ref_diagnosis_justification.id IS 'Идентификатор из справочника (CSV), не менять';

-- 1.2.643.5.1.13.13.11.1049 — Характер заболевания
-- CSV: F_025-1u;NAME;ID
CREATE TABLE IF NOT EXISTS ref_disease_character (
    row_id BIGSERIAL PRIMARY KEY,
    id INTEGER,
    name VARCHAR(255)
);
COMMENT ON TABLE ref_disease_character IS 'OID: 1.2.643.5.1.13.13.11.1049. Характер заболевания';
COMMENT ON COLUMN ref_disease_character.id IS 'Идентификатор из справочника (CSV), не менять';


-- =========================================
-- Справочник МИС (дальше сюда зальются внутренние справочиники)
-- =========================================

CREATE TABLE ref_mis (
    row_id bigserial PRIMARY KEY,

    mis_id bigint, --id из МИС
    mis_name varchar(500), -- название сущности из МИС

    ref_code varchar(255), -- внутренний код (код группы или уже само значение)
    ref_name varchar(500), -- название (тут или название группы или уже само значение)

    parent_id bigint, -- id родителя
    is_group boolean NOT NULL DEFAULT false, -- является ли группой
    is_active boolean NOT NULL DEFAULT true, -- является ли активной

    level int NOT NULL DEFAULT 0, -- уровень вложенности (ускоряет выборки)
    path text NULL, -- путь (опционально, но может быть полезно) например: /1/5/23/

    attributes jsonb NULL, -- на всякий случай, можно использовать для хранения дополнительных данных

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz NULL
);


-- -- =========================================
-- -- Основная сущность: протокол консультации
-- -- =========================================

-- CREATE TABLE IF NOT EXISTS consultation (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

--     service_user UUID REFERENCES service_user(id),

--     -- Интеграция с внешней клинической системой (заполняется при интеграции)
--     external_system INTEGER, -- идентификатор внешней системы (EMR/МИС)
--     external_patient_id INTEGER, -- внешний ID пациента
--     external_doctor_id INTEGER, -- внешний ID врача
--     external_visit_id INTEGER, -- внешний ID визита/обращения

--     consultation_datetime TIMESTAMPTZ, -- дата/время консультации

--     -- 1. Жалобы
--     complaints TEXT,

--     -- 2. Анамнез заболевания
--     disease_anamnesis TEXT,

--     -- 3. История заболевания
--     disease_history TEXT,

--     -- 4. Состояние пациента
--     patient_condition TEXT,

--     -- 5. Анамнез жизни
--     life_anamnesis TEXT,

--     -- 6. Вредные привычки и зависимости
--     bad_habits TEXT,

--     -- 7. Аллергологический анамнез
--     allergy_anamnesis TEXT,

--     -- 8. Витальные параметры
--     vital_parameters TEXT,

--     -- 9. Объективные данные
--     objective_data TEXT,

--     -- 10. Объективизированная оценка состояния
--     clinical_assessment TEXT,

--     -- 11. Заключение консультации
--     consultation_conclusion TEXT,

--     -- 12. Диагнозы: основной и сопутствующие
--     main_diagnosis TEXT,
--     comorbid_diagnoses TEXT,

--     -- 13. Рекомендации
--     recommendations TEXT,

--     -- 14. Назначения
--     prescriptions TEXT,

--     -- Служебные поля
--     protocol_name VARCHAR(255), -- название протокола
--     status_protocol VARCHAR(255), -- статус протокола (draft/active/cancelled/archived и т.п.)
--     created_at TIMESTAMPTZ DEFAULT now(),
--     updated_at TIMESTAMPTZ,
--     deleted_at TIMESTAMPTZ,

--     protocol_template_id UUID REFERENCES protocol_template(id),
--     extra_fields JSONB
-- );

-- COMMENT ON TABLE consultation IS 'Протоколы консультаций (объединённая сущность, все разделы протокола в одной таблице)';

-- CREATE INDEX IF NOT EXISTS idx_consultation_datetime
--     ON consultation (consultation_datetime);

-- CREATE INDEX IF NOT EXISTS idx_consultation_protocol_template_id
--     ON consultation (protocol_template_id);



-- =========================================
-- Структуры протоколов консультаций
-- =========================================

CREATE TABLE IF NOT EXISTS protocol_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    creator_id UUID NOT NULL REFERENCES service_user (id),
    structure_code VARCHAR(255) NOT NULL,
    structure_name VARCHAR(500) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE protocol_structures IS
    'Версионируемые структуры протоколов';

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_structures_code_version_unique
    ON protocol_structures (structure_code, version);

CREATE INDEX IF NOT EXISTS idx_protocol_structures_creator_id
    ON protocol_structures (creator_id);

CREATE INDEX IF NOT EXISTS idx_protocol_structures_is_active
    ON protocol_structures (is_active);


CREATE TABLE IF NOT EXISTS protocol_structures_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    protocol_structure_id UUID NOT NULL REFERENCES protocol_structures (id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    field_label VARCHAR(500),
    description TEXT,
    field_type VARCHAR(255) NOT NULL,
    default_value TEXT,
    dictionary VARCHAR(255),
    protocol_fields_main_id UUID REFERENCES protocol_fields_main (id),
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE protocol_structures_fields IS
    'Поля внутри версии protocol_structures';

CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_structure_id
    ON protocol_structures_fields (protocol_structure_id);

CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_sort
    ON protocol_structures_fields (protocol_structure_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_protocol_fields_main_id
    ON protocol_structures_fields (protocol_fields_main_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_structures_fields_name_unique
    ON protocol_structures_fields (protocol_structure_id, field_name);


-- =========================================
-- Справочник ключевых полей протокола для автодополнения
-- =========================================
CREATE TABLE IF NOT EXISTS protocol_fields_main (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name VARCHAR(255),
    field_label VARCHAR(255),
    description TEXT,
    endpoint_link VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE protocol_fields_main IS
    'Справочник ключевых полей протокола для автодополнения';

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_fields_main_field_name_unique
    ON protocol_fields_main (field_name)
    WHERE deleted_at IS NULL;


INSERT INTO protocol_fields_main (
    field_name,
    field_label,
    description,
    endpoint_link
)
VALUES
    ('complaints', 'Жалобы', 'Жалобы пациента', NULL),
    ('disease_anamnesis', 'Анамнез заболевания', 'Анамнез заболевания', NULL),
    ('disease_history', 'История заболевания', 'История заболевания', NULL),
    ('patient_condition', 'Состояние пациента', 'Состояние пациента', NULL),
    ('life_anamnesis', 'Анамнез жизни', 'Анамнез жизни', NULL),
    ('bad_habits', 'Вредные привычки и зависимости', 'Вредные привычки и зависимости', NULL),
    ('allergy_anamnesis', 'Аллергологический анамнез', 'Аллергологический анамнез', NULL),
    ('vital_parameters', 'Витальные параметры', 'Витальные параметры', NULL),
    ('objective_data', 'Объективные данные', 'Объективные данные', NULL),
    ('clinical_assessment', 'Объективизированная оценка состояния', 'Объективизированная оценка состояния', NULL),
    ('consultation_conclusion', 'Заключение консультации', 'Заключение консультации', NULL),
    ('main_diagnosis', 'Основной диагноз', 'Основной диагноз', NULL),
    ('comorbid_diagnoses', 'Сопутствующие диагнозы', 'Сопутствующие диагнозы', NULL),
    ('recommendations', 'Рекомендации', 'Рекомендации', NULL),
    ('prescriptions', 'Назначения', 'Назначения', NULL)
ON CONFLICT (field_name) WHERE deleted_at IS NULL DO NOTHING;

-- =========================================
-- Сущности для протоколов
-- =========================================

CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    service_user UUID REFERENCES service_user (id),
    protocol_structure_id UUID REFERENCES protocol_structures(id) ON DELETE SET NULL,
    patient_id INTEGER,
    doctor_id UUID REFERENCES service_user (id),

    protocol_name VARCHAR(255),
    status_protocol VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE protocols IS
    'Экземпляр протокола по выбранной структуре';

CREATE INDEX IF NOT EXISTS idx_protocols_service_user
    ON protocols (service_user);

CREATE INDEX IF NOT EXISTS idx_protocols_patient_id
    ON protocols (patient_id);

CREATE INDEX IF NOT EXISTS idx_protocols_doctor_id
    ON protocols (doctor_id);

CREATE INDEX IF NOT EXISTS idx_protocols_protocol_structure_id
    ON protocols (protocol_structure_id);


CREATE TABLE IF NOT EXISTS protocol_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    protocol_id UUID NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES protocol_structures_fields (id),
    field_value TEXT
);

COMMENT ON TABLE protocol_fields IS
    'Значения полей экземпляра протокола (связь с определением поля в protocol_structures_fields)';

CREATE INDEX IF NOT EXISTS idx_protocol_fields_protocol_id
    ON protocol_fields (protocol_id);

CREATE INDEX IF NOT EXISTS idx_protocol_fields_field_id
    ON protocol_fields (field_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_fields_protocol_field_unique
    ON protocol_fields (protocol_id, field_id);


-- =========================================
-- Сущности для пользователей
-- =========================================

-- Таблица пользователя сервиса
CREATE TABLE IF NOT EXISTS service_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    login VARCHAR(255) UNIQUE NOT NULL, -- логин пользователя
    password_hash TEXT NOT NULL, -- хэш пароля

    first_name VARCHAR(255),
    last_name VARCHAR(255),

    role VARCHAR(50) NOT NULL DEFAULT 'doctor', -- роль пользователя (admin/head of department/doctor)

    is_active BOOLEAN NOT NULL DEFAULT true, -- активен ли пользователь

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE service_user IS 'Пользователи сервиса (администраторы, операторы системы)';
COMMENT ON COLUMN service_user.password_hash IS 'Хэш пароля пользователя';
COMMENT ON COLUMN service_user.role IS 'Роль пользователя сервиса';

CREATE INDEX IF NOT EXISTS idx_service_user_email
    ON service_user (login);


-- Ожидающая регистрация: до подтверждения кода строки в service_user нет
CREATE TABLE IF NOT EXISTS registration_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    login VARCHAR(255) NOT NULL,
    -- Хэш пароля для будущей записи service_user (как в service_user.password_hash)
    password_hash TEXT NOT NULL,
    -- Хэш одноразового кода из письма (не хранить код в открытом виде)
    code_hash TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    code_attempts SMALLINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE registration_pending IS
    'Временные заявки на регистрацию до подтверждения email; после успеха — запись в service_user, строка удаляется';
COMMENT ON COLUMN registration_pending.login IS
    'Email пользователя; совпадает с будущим service_user.login';
COMMENT ON COLUMN registration_pending.code_attempts IS
    'Число неудачных попыток ввода кода (защита от перебора)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_pending_login
    ON registration_pending (login);

CREATE INDEX IF NOT EXISTS idx_registration_pending_expires_at
    ON registration_pending (expires_at);







-- =========================================
-- Сущности для групп и шаблонов протоколов
-- =========================================

CREATE TABLE IF NOT EXISTS template_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name VARCHAR(255), -- название группы
    creator_id UUID REFERENCES service_user(id), -- идентификатор создателя (ссылка на пользователя)
    created_at TIMESTAMPTZ DEFAULT now(), -- дата создания
    updated_at TIMESTAMPTZ, -- дата изменения
    deleted_at TIMESTAMPTZ -- дата удаления
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_group_creator_group_name_unique
    ON template_group (creator_id, lower(group_name))
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS protocol_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_name VARCHAR(255), -- название шаблона
    group_id UUID REFERENCES template_group(id), -- идентификатор группы (ссылка на группу или NULL)
    creator_id UUID REFERENCES service_user(id), -- идентификатор создателя (ссылка на пользователя)
    protocol_structure_id UUID REFERENCES protocol_structures(id) ON DELETE SET NULL, -- структура протокола
    privacy VARCHAR(255), -- приватность ("Общий" или "Личный")
    created_at TIMESTAMPTZ DEFAULT now(), -- дата создания
    updated_at TIMESTAMPTZ, -- дата изменения
    deleted_at TIMESTAMPTZ -- дата удаления
);

CREATE TABLE IF NOT EXISTS protocol_template_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_template_id UUID REFERENCES protocol_template(id), -- идентификатор шаблона (ссылка на шаблон)
    field_name VARCHAR(255), -- название поля
    field_type VARCHAR(255), -- тип поля
    field_value TEXT, -- значение поля
    created_at TIMESTAMPTZ DEFAULT now(), -- дата создания
    updated_at TIMESTAMPTZ, -- дата изменения
    deleted_at TIMESTAMPTZ -- дата удаления
);



-- =========================================
-- Логи событий автодополнения
-- =========================================

CREATE TABLE IF NOT EXISTS autocomplete_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- уникальный идентификатор события показа подсказок
    user_id UUID NOT NULL REFERENCES service_user(id), -- пользователь, вызвавший автодополнение
    field_name VARCHAR(255) NOT NULL, -- поле ввода, в котором вызваны подсказки
    prefix TEXT NOT NULL, -- введённый пользователем префикс до запроса
    suggestions_count INTEGER, -- количество предложенных вариантов
    selected_text TEXT, -- выбранный вариант; NULL, если ничего не выбрано
    event_type VARCHAR(64) NOT NULL, -- тип события (form_click/autocomplete_shown/suggestion_selected)
    shown_at TIMESTAMPTZ(3) NOT NULL DEFAULT now() -- момент показа подсказок пользователю (до миллисекунд)
);

CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_user_id
    ON autocomplete_stats (user_id);

CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_shown_at
    ON autocomplete_stats (shown_at);

CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_field_name
    ON autocomplete_stats (field_name);

CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_event_type
    ON autocomplete_stats (event_type);


-- =========================================
-- Логи проверки полноты в поле Жалобы
-- =========================================

CREATE TABLE IF NOT EXISTS fullness_complaints_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES service_user(id),
    status VARCHAR(255),
    color VARCHAR(255),
    analysis TEXT,
    suggested_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_user_id
    ON fullness_complaints_stats (user_id);

CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_created_at
    ON fullness_complaints_stats (created_at);

CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_deleted_at
    ON fullness_complaints_stats (deleted_at);

CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_status
    ON fullness_complaints_stats (status);


-- =========================================
-- Таблицы автодополнения
-- =========================================
-- Таблица словаря
CREATE TABLE IF NOT EXISTS ml_unigrams (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    frequency INTEGER NOT NULL DEFAULT 0,
    weight FLOAT NOT NULL DEFAULT 0
);

-- Таблица биграмм с полем bigram
CREATE TABLE IF NOT EXISTS ml_bigrams (
    id SERIAL PRIMARY KEY,
    bigram TEXT NOT NULL UNIQUE,
    first_word TEXT NOT NULL,
    second_word TEXT NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    weight FLOAT NOT NULL DEFAULT 0
);

-- Индексы для скорости поиска
CREATE INDEX IF NOT EXISTS idx_dict_word ON ml_unigrams (word text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_dict_weight ON ml_unigrams (weight DESC);
CREATE INDEX IF NOT EXISTS idx_bigram_bigram ON ml_bigrams (bigram text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_bigram_first ON ml_bigrams (first_word text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_bigram_weight ON ml_bigrams (weight DESC);