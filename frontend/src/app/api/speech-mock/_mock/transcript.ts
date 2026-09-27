// Генерация демонстрационной расшифровки для заглушки распознавания.
//
// Идентификаторы полей берутся у настоящего backend: мок запрашивает протокол
// и его структуру тем же токеном, который прислал браузер. Без этого результат
// некуда разложить — ключи `field_values` должны совпадать с UUID полей.

const API_MAIN_URL = process.env.API_MAIN_URL || 'http://localhost:8000';

interface StructureField {
  id: string;
  field_label: string | null;
  field_name: string;
  field_type: string;
  sort_order: number;
}

const fetchJson = async <T>(path: string, authorization: string) => {
  const response = await fetch(`${API_MAIN_URL}${path}`, {
    headers: { Authorization: authorization },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
};

/** Текстовые поля структуры протокола в порядке отображения. */
const loadTextFields = async (
  protocolId: string,
  authorization: string,
): Promise<StructureField[]> => {
  const protocol = await fetchJson<{ protocol_structure_id: string | null }>(
    `/protocols/${protocolId}`,
    authorization,
  );
  if (!protocol?.protocol_structure_id) return [];

  const structure = await fetchJson<{ fields: StructureField[] }>(
    `/protocol-structures/${protocol.protocol_structure_id}`,
    authorization,
  );
  if (!structure?.fields) return [];

  return structure.fields
    .filter((field) => (field.field_type ?? 'text') === 'text')
    .sort((a, b) => a.sort_order - b.sort_order);
};

const PHRASES = [
  'со слов пациента, беспокоит около трёх дней, интенсивность умеренная',
  'состояние удовлетворительное, изменений по сравнению с прошлым визитом нет',
  'жалоб дополнительно не предъявляет, приём препаратов не менял',
  'отмечает улучшение после назначенной терапии, побочных эффектов не было',
  'данные уточнены при осмотре, ограничений подвижности не выявлено',
];

const textForField = (field: StructureField, index: number): string => {
  const label = (field.field_label || field.field_name).trim();
  return `(демо-расшифровка) ${label}: ${PHRASES[index % PHRASES.length]}.`;
};

export interface MockTranscription {
  transcript: string;
  fieldValues: Record<string, string>;
}

/**
 * Демонстрационный результат «распознавания».
 *
 * Последнее текстовое поле намеренно остаётся без значения: так на экране
 * видно, что поле, о котором в приёме не говорили, остаётся нетронутым.
 */
export const buildMockTranscription = async (
  protocolId: string,
  authorization: string,
): Promise<MockTranscription> => {
  const fields = await loadTextFields(protocolId, authorization);
  const filled = fields.length > 1 ? fields.slice(0, -1) : fields;

  const fieldValues: Record<string, string> = {};
  filled.forEach((field, index) => {
    fieldValues[field.id] = textForField(field, index);
  });

  const transcript = [
    '(демонстрационная расшифровка: сервис распознавания ещё не подключён)',
    '',
    ...filled.map((field, index) => textForField(field, index)),
  ].join('\n');

  return { transcript, fieldValues };
};
