import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';

export type GastroValues = Record<string, string | string[]>;
export interface GastroField {
  key: string;
  label: string;
  type: 'single' | 'multi' | 'text' | 'multiline' | 'date' | 'list';
  options?: { value: string; label: string; warning?: string }[];
  required?: boolean;
  max_length?: number;
  max_items?: number;
  item_max_length?: number;
  placeholder?: string;
  help?: string;
  show_when?: { key: string; value: string };
  exclusive_values?: string[];
}
export interface GastroMeta {
  screen: 'form' | 'history' | 'review' | 'ai_offer' | 'ai_wait' | 'ai_question' | 'questions';
  section: string;
  revision: number;
  can_back: boolean;
  fields: GastroField[];
  values: GastroValues;
  warnings: string[];
  summary: { label: string; value: string }[];
  actions: { value: string; label: string; primary?: boolean }[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const fieldTypes = new Set(['single', 'multi', 'text', 'multiline', 'date', 'list']);
const screens = new Set(['form', 'history', 'review', 'ai_offer', 'ai_wait', 'ai_question', 'questions']);
const forbiddenKey = /(?:^|[._])(age|birth_date|birth_year|appointment_time)(?:$|[._])/;

const parseField = (value: unknown): GastroField | null => {
  if (!record(value) || typeof value.key !== 'string' || !value.key || forbiddenKey.test(value.key)
    || typeof value.label !== 'string' || typeof value.type !== 'string' || !fieldTypes.has(value.type)) return null;
  if (value.options !== undefined && (!Array.isArray(value.options) || !value.options.every((o) =>
    record(o) && typeof o.value === 'string' && typeof o.label === 'string'))) return null;
  if (value.show_when !== undefined && (!record(value.show_when)
    || typeof value.show_when.key !== 'string' || typeof value.show_when.value !== 'string')) return null;
  if (value.exclusive_values !== undefined && !strings(value.exclusive_values)) return null;
  if (value.max_length !== undefined && (!Number.isInteger(value.max_length)
    || Number(value.max_length) < 1 || Number(value.max_length) > 20000)) return null;
  return value as unknown as GastroField;
};

/** Неизвестный дескриптор не должен незаметно терять обязательное поле. */
export const gastroMeta = (step: QuestionnaireStep): GastroMeta | null => {
  const raw = step.gastro;
  if (!record(raw) || typeof raw.screen !== 'string' || !screens.has(raw.screen)
    || typeof raw.section !== 'string' || !Number.isInteger(raw.revision)
    || Number(raw.revision) < 0 || !Array.isArray(raw.fields) || !record(raw.values)) return null;
  const fields = raw.fields.map(parseField);
  if (fields.some((field) => field === null) || new Set(fields.map((f) => f!.key)).size !== fields.length) return null;
  const values: GastroValues = {};
  for (const [key, value] of Object.entries(raw.values)) {
    if (typeof value === 'string' || strings(value)) values[key] = value;
  }
  const summary = raw.summary ?? [];
  const actions = raw.actions ?? [];
  if (!Array.isArray(summary) || !summary.every((s) => record(s)
    && typeof s.label === 'string' && typeof s.value === 'string')) return null;
  if (!Array.isArray(actions) || !actions.every((a) => record(a)
    && typeof a.value === 'string' && typeof a.label === 'string')) return null;
  if (raw.warnings !== undefined && !strings(raw.warnings)) return null;
  return { screen: raw.screen as GastroMeta['screen'], section: raw.section,
    revision: Number(raw.revision), can_back: raw.can_back === true,
    fields: fields as GastroField[], values, warnings: (raw.warnings ?? []) as string[],
    summary: summary as GastroMeta['summary'], actions: actions as GastroMeta['actions'] };
};

export const isGastroFieldVisible = (field: GastroField, values: GastroValues): boolean => {
  if (!field.show_when) return true;
  const value = values[field.show_when.key];
  return Array.isArray(value) ? value.includes(field.show_when.value) : value === field.show_when.value;
};

export const toggleGastroChoice = (field: GastroField, selected: string[], value: string): string[] => {
  if (field.type === 'single') return [value];
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  const exclusive = field.exclusive_values ?? [];
  return exclusive.includes(value) ? [value] : [...selected.filter((item) => !exclusive.includes(item)), value];
};

export const validateGastroFields = (fields: GastroField[], values: GastroValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!isGastroFieldVisible(field, values)) continue;
    const value = values[field.key];
    const parts = Array.isArray(value) ? value : [value ?? ''];
    if (field.required && !parts.some((part) => part.trim())) {
      errors[field.key] = 'Выберите ответ или заполните поле.';
    } else if (field.type === 'list' && (parts.filter((part) => part.trim()).length > (field.max_items ?? 30)
      || parts.some((part) => part.length > (field.item_max_length ?? 2000)))) {
      errors[field.key] = `До ${field.max_items ?? 30} вопросов, каждый до ${field.item_max_length ?? 2000} символов.`;
    } else if (field.type === 'list' && field.max_length && JSON.stringify(parts.filter((part) => part.trim())).length > field.max_length) {
      errors[field.key] = `Сократите список до ${field.max_length} символов. Вопросы не были обрезаны.`;
    } else if (field.max_length && parts.some((part) => part.length > field.max_length!)) {
      errors[field.key] = `Сократите ответ до ${field.max_length} символов. Текст не был обрезан.`;
    }
  }
  return errors;
};

export const buildGastroAnswer = (
  step: QuestionnaireStep,
  values: GastroValues,
  action?: string,
): QuestionnaireStepAnswer => {
  const meta = gastroMeta(step);
  if (!meta) throw new Error('Unsupported gastro descriptor');
  const base = { step_key: step.step_key, revision: meta.revision };
  if (action && action !== 'back') return { ...base, choice: action };
  const selections: Record<string, string[]> = {};
  const texts: Record<string, string> = {};
  for (const field of meta.fields) {
    if (!isGastroFieldVisible(field, values)) continue;
    const value = values[field.key];
    if (field.type === 'single' || field.type === 'multi') {
      selections[field.key] = Array.isArray(value) ? value : value ? [value] : [];
    } else if (field.type === 'list') {
      texts[field.key] = JSON.stringify((Array.isArray(value) ? value : []).filter((item) => item.trim()));
    } else {
      texts[field.key] = typeof value === 'string' ? value : '';
    }
  }
  return { ...base, ...(action ? {choice:action} : {}), selections, texts };
};
