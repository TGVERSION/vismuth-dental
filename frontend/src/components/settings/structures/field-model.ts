// Модель поля структуры протокола: типы редактора и чистые преобразования
// между ним и форматом, который хранит сервер (`default_value_jsonb`).
//
// Вынесено из ProtocolStructuresSection, чтобы разбор и сборка вариантов
// поля были покрыты тестами: ошибка здесь означает потерянные варианты
// выбора в структуре протокола.

import type { DropdownOption } from '../../CustomDropdown';

export const FIELD_TYPES: DropdownOption<string>[] = [
  { value: 'text', label: 'Текст' },
  { value: 'select', label: 'Выбор одного из списка' },
  { value: 'multiselect', label: 'Множественный выбор из списка' },
  { value: 'radio', label: 'Один вариант выбора (радиокнопки)' },
  { value: 'checkbox', label: 'Несколько вариантов выбора (галочки)' },
];

export const getTypeLabel = (type: string) =>
  FIELD_TYPES.find((t) => t.value === type)?.label ?? type;

export const isOptionsType = (type: string) =>
  type === 'radio' || type === 'checkbox';

export const DICT_LIMIT = 50;

/**
 * Варианты справочника из ответа `/ref/{name}`: берём первую неслужебную
 * колонку, пропуская `row_id` и числовые поля.
 */
export const extractDictEntries = (
  items: Record<string, unknown>[],
): DropdownOption<string>[] => {
  if (!items.length) return [];
  const nonIdKeys = Object.keys(items[0]).filter((k) => k !== 'row_id');
  const firstKey =
    nonIdKeys.find((k) => typeof items[0][k] !== 'number') ?? nonIdKeys[0];
  if (!firstKey) return [];
  return items
    .map((item) => String(item[firstKey] ?? ''))
    .filter(Boolean)
    .map((text) => ({ value: text, label: text }));
};

export interface LocalOption {
  localId: string;
  text: string;
  isDefault: boolean;
}

export interface LocalField {
  localId: string;
  id?: string;
  field_name: string;
  field_label: string;
  field_type: string;
  default_value: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default_value_jsonb: any;
  dictionary: string | null;
  protocol_fields_main_id: string | null;
  is_required: boolean;
  sort_order: number;
  options: LocalOption[];
}

let counter = 0;
export const uid = () =>
  `uid-${++counter}-${Math.random().toString(36).slice(2, 6)}`;

// Транслитерация для имён полей. Без неё `\w` в регулярном выражении, который
// понимает только латиницу, вычищал всю кириллицу: подпись «Жалобы пациента»
// превращалась в имя поля «_», а все русские названия структур давали
// одинаковый код «_».
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

const transliterate = (text: string) =>
  text.replace(/[а-яё]/g, (char) => CYRILLIC_MAP[char] ?? char);

/**
 * Имя поля для сервера из человекочитаемой подписи.
 * Кириллица транслитерируется, остальное непечатное вычищается.
 */
export const slugify = (text: string) => {
  const slug = transliterate(text.toLowerCase())
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);

  return slug || `field_${Date.now()}`;
};

/**
 * Варианты поля из хранимого JSON. У `checkbox` значений по умолчанию может
 * быть несколько (`defaults`), у остальных типов — одно (`default`).
 */
export function parseOptions(
  jsonb: unknown,
  fieldType?: string,
): LocalOption[] {
  if (!jsonb || typeof jsonb !== 'object') return [];
  const data = jsonb as {
    options?: unknown;
    default?: string | null;
    defaults?: string[] | null;
  };
  if (!Array.isArray(data.options)) return [];

  if (fieldType === 'checkbox' && Array.isArray(data.defaults)) {
    const defaults = data.defaults;
    return (data.options as string[]).map((text) => ({
      localId: uid(),
      text: String(text),
      isDefault: defaults.includes(text),
    }));
  }

  return (data.options as string[]).map((text) => ({
    localId: uid(),
    text: String(text),
    isDefault: data.default === text,
  }));
}

/** Обратное преобразование: варианты редактора в хранимый JSON. */
export function serializeOptions(options: LocalOption[], fieldType?: string) {
  if (!options.length) return null;

  if (fieldType === 'checkbox') {
    const defaults = options.filter((o) => o.isDefault).map((o) => o.text);
    return {
      options: options.map((o) => o.text),
      defaults: defaults.length ? defaults : null,
    };
  }

  const def = options.find((o) => o.isDefault);
  return { options: options.map((o) => o.text), default: def?.text ?? null };
}
