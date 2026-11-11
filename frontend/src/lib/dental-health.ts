import type { DentalHealthRow } from '@/api';

/** Неопределённость не является отрицательным медицинским ответом. */
export const partitionDentalHealth = (rows: readonly DentalHealthRow[]) => ({
  positive: rows.filter((row) => row.has === true),
  negative: rows.filter((row) => row.has === false),
  uncertain: rows.filter((row) => row.has == null),
});

const EMPTY_DENTAL_SUMMARIES = new Set([
  '',
  '—',
  'Не отвечено.',
  'Аллергии нет.',
  'Постоянно не принимает.',
  'Хронических заболеваний не отмечено.',
]);

export const dentalSummaryText = (value: string | null | undefined): string => {
  const text = value?.trim() ?? '';
  return EMPTY_DENTAL_SUMMARIES.has(text) ? '' : text;
};
