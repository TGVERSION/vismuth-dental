import type { DentalHealthRow } from '@/api';

/** Неопределённость не является отрицательным медицинским ответом. */
export const partitionDentalHealth = (rows: readonly DentalHealthRow[]) => ({
  positive: rows.filter((row) => row.has === true),
  negative: rows.filter((row) => row.has === false),
  uncertain: rows.filter((row) => row.has == null),
});
