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
    synonym VARCHAR(100),
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
    name VARCHAR(500),
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
-- Основная сущность: протокол консультации
-- =========================================

CREATE TABLE IF NOT EXISTS consultation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    service_user UUID REFERENCES service_user(id),

    -- Интеграция с внешней клинической системой (заполняется при интеграции)
    external_system INTEGER, -- идентификатор внешней системы (EMR/МИС)
    external_patient_id INTEGER, -- внешний ID пациента
    external_doctor_id INTEGER, -- внешний ID врача
    external_visit_id INTEGER, -- внешний ID визита/обращения

    consultation_datetime TIMESTAMPTZ, -- дата/время консультации

    complaints TEXT, -- Жалобы
    disease_anamnesis TEXT, -- Анамнез заболевания
    recommendations TEXT, -- Рекомендации
    prescriptions TEXT, -- Назначения
    disease_history TEXT, -- История заболевания (раздел протокола)

    -- Служебные поля
    status_protocol VARCHAR(255), -- статус протокола (draft/active/cancelled/archived и т.п.)
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation IS 'Протоколы консультаций';

CREATE INDEX IF NOT EXISTS idx_consultation_datetime
    ON consultation (consultation_datetime);


-- =========================================
-- Связанные сущности протокола
-- =========================================

-- Сведения о консультации
CREATE TABLE IF NOT EXISTS consultation_protocols (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    patient_condition VARCHAR(255),
    objective_data VARCHAR(255),
    consultation_conclusion VARCHAR(255),
    pathology_code VARCHAR(255), -- код выявленной патологии (OID: 1.2.643.5.1.13.13.11.1473)
    comment VARCHAR(255),
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_protocols IS 'Сведения о консультации';

CREATE INDEX IF NOT EXISTS idx_consultation_protocols_consultation
    ON consultation_protocols (consultation_id);


-- Вредные привычки и зависимости
CREATE TABLE IF NOT EXISTS consultation_habit (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    bad_habits VARCHAR(255),
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_habit IS 'Анамнез жизни: вредные привычки и зависимости';

CREATE INDEX IF NOT EXISTS idx_consultation_habit_consultation
    ON consultation_habit (consultation_id);


-- Аллергологический анамнез
CREATE TABLE IF NOT EXISTS consultation_allergy_manifestation (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    reaction_type VARCHAR(255), -- Тип реакции
    clinical_manifestations VARCHAR(255), -- Клинические проявления
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_allergy_manifestation IS 'Аллергологический анамнез';

CREATE INDEX IF NOT EXISTS idx_consultation_allergy_manifestation_consultation
    ON consultation_allergy_manifestation (consultation_id);


-- Витальные параметры
CREATE TABLE IF NOT EXISTS consultation_vital_sign (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    parameter_code VARCHAR(255), -- Код параметра
    unit_code VARCHAR(255), -- Единицы измерения
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_vital_sign IS 'Витальные параметры пациента в рамках консультации';
COMMENT ON COLUMN consultation_vital_sign.parameter_code IS 'Код параметра витальных показателей (справочник OID 1.2.643.5.1.13.13.99.2.262).';
COMMENT ON COLUMN consultation_vital_sign.unit_code IS 'Код единицы измерения (справочник OID 1.2.643.5.1.13.13.11.1358).';

CREATE INDEX IF NOT EXISTS idx_consultation_vital_sign_consultation
    ON consultation_vital_sign (consultation_id);


-- Объективизированная оценка состояния
CREATE TABLE IF NOT EXISTS consultation_clinical_scale (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    scale_type VARCHAR(255), -- Тип клинической шкалы
    unit_code VARCHAR(255), -- Единицы измерения
    scale_parameter VARCHAR(255), -- Параметр клинической шкалы
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_clinical_scale IS 'Объективизированная оценка состояния пациента';

CREATE INDEX IF NOT EXISTS idx_consultation_clinical_scale_consultation
    ON consultation_clinical_scale (consultation_id);


-- Диагнозы
CREATE TABLE IF NOT EXISTS consultation_diagnosis (
    id BIGSERIAL PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES consultation(id) ON DELETE CASCADE,
    diagnosis_type VARCHAR(255), -- Вид нозологической единицы диагноза
    icd10_code VARCHAR(255), -- Код диагноза по МКБ-10
    diagnosis_validity VARCHAR(255), -- Степень обоснованности диагноза
    disease_nature VARCHAR(255), -- Характер заболевания
    created_at TIMESTAMPTZ
);

COMMENT ON TABLE consultation_diagnosis IS 'Диагнозы в рамках консультации';

CREATE INDEX IF NOT EXISTS idx_consultation_diagnosis_consultation
    ON consultation_diagnosis (consultation_id);




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

    role VARCHAR(50) NOT NULL DEFAULT 'admin', -- роль пользователя (admin/operator/viewer)

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



--
--ALTER TABLE consultation
--ADD COLUMN author_id UUID REFERENCES service_user(id);






























