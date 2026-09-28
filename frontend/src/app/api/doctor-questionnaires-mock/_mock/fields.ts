// Раскладка анкеты по полям протокола — копия логики backend
// (`routers/questionnaires.py`: `_map_structured_to_fields`,
// `_apply_medications_fallback` и цикл по полям структуры в
// `create_protocol_from_questionnaire`). Нужна только заглушке, чтобы в
// разработке было видно заполненный протокол; в production раскладку делает
// сервер. Меняется backend — меняется и этот файл.

import type {
  DoctorQuestionnaireStructured,
  ProtocolFcieldsMain,
  StructureProtocolsFields,
} from '@/api';

/** Текст анкеты по кодам полей справочника (`protocol_fields_main`). */
const mapStructured = (
  structured: DoctorQuestionnaireStructured,
): Record<string, string> => {
  const result: Record<string, string> = {
    complaints: structured.complaints ?? '',
    life_anamnesis: structured.life_anamnesis ?? '',
    allergy_anamnesis: structured.allergy_anamnesis ?? '',
  };

  const medications = (structured.medications ?? '').trim();
  if (medications) result.medications = medications;

  return result;
};

/** Поля препаратов в структуре нет — препараты дописываются в жалобы. */
const applyMedicationsFallback = (
  mapped: Record<string, string>,
  structureCodes: Set<string>,
): Record<string, string> => {
  const medications = mapped.medications;
  if (!medications || structureCodes.has('medications')) return mapped;

  const result = { ...mapped };
  delete result.medications;

  const prefix = `Препараты: ${medications}`;
  result.complaints = result.complaints
    ? `${result.complaints}\n${prefix}`
    : prefix;
  return result;
};

/**
 * `field_values` нового протокола: id поля структуры → текст. Поле
 * сопоставляется с анкетой по коду из справочника, пустые значения не
 * передаются.
 *
 * Без `structured` backend раскладывает исходные ответы пациента; у демо-анкет
 * заглушки ответов нет, и backend на них тоже ничего бы не заполнил.
 */
export const buildFieldValues = (
  structured: DoctorQuestionnaireStructured | null,
  fields: Pick<StructureProtocolsFields, 'id' | 'protocol_fields_main_id'>[],
  mains: Pick<ProtocolFcieldsMain, 'id' | 'field_name'>[],
): Record<string, string> => {
  if (!structured) return {};

  const codeByMainId = new Map(mains.map((main) => [main.id, main.field_name]));
  const codeOf = (field: (typeof fields)[number]): string | null =>
    field.protocol_fields_main_id
      ? (codeByMainId.get(field.protocol_fields_main_id) ?? null)
      : null;

  const structureCodes = new Set(
    fields.map(codeOf).filter((code): code is string => Boolean(code)),
  );
  const mapped = applyMedicationsFallback(
    mapStructured(structured),
    structureCodes,
  );

  const values: Record<string, string> = {};
  for (const field of fields) {
    const code = codeOf(field);
    const value = code ? mapped[code] : undefined;
    if (value) values[field.id] = value;
  }
  return values;
};
