export interface HistoryItem { label: string; value: string }
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const labels: Record<string, string> = {
  history_narrative: 'Рассказ пациента', history_examinations: 'Обследования',
  history_treatments: 'Лечение', history_outcomes: 'Результаты лечения и реакции',
  history_changes: 'Что изменилось сейчас',
};

export function readGastroHistory(value: unknown): { raw: HistoryItem[]; chronology: HistoryItem[] } {
  if (!record(value)) return { raw: [], chronology: [] };
  const raw = record(value.raw) ? Object.entries(value.raw)
    .filter(([key, text]) => key in labels && typeof text === 'string' && text.trim())
    .map(([key, text]) => ({ label: labels[key], value: text as string })) : [];
  const chronology: HistoryItem[] = [];
  if (Array.isArray(value.chronology)) for (const item of value.chronology) {
    if (!record(item) || typeof item.label !== 'string') continue;
    const text = typeof item.value === 'string' ? item.value : typeof item.text === 'string' ? item.text : null;
    if (text === null) continue;
    const period = typeof item.period === 'string' ? item.period : '';
    chronology.push({label:item.label,value:period ? `${period}\n${text}` : text});
  }
  return { raw, chronology };
}

export const readPatientQuestions = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
