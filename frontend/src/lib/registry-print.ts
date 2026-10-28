// Лист А4 для подписи пациента — бланк «Анкета о здоровье» (МК Дент),
// заполненный его ответами и сжатый на одну страницу.
//
// Строки бланка, их формулировки и ответы собирает сервер (`paper_form`):
// здесь только ФИО из анкеты. Пациент подписывает свои ответы, поэтому
// ни «Самого важного», ни подсказок врачу на листе нет.

import type { DentalPaperForm, RegistryQuestionnaireDetail } from '@/api';

export interface PrintSheet {
  lastName: string;
  /** «Ольга Сергеевна». */
  firstMiddle: string;
  form: DentalPaperForm;
}

const joinName = (...parts: (string | null)[]): string =>
  parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

/** Null — анкета заполнена до бланка: печатать нечего. */
export const printSheet = (
  detail: RegistryQuestionnaireDetail,
): PrintSheet | null => {
  const form = detail.structured?.paper_form;
  if (!form) return null;
  return {
    lastName: detail.patient_last_name?.trim() ?? '',
    firstMiddle: joinName(
      detail.patient_first_name,
      detail.patient_middle_name,
    ),
    form,
  };
};

/** Последняя строка левого столбца — как конец первой страницы бумажного бланка. */
export const FIRST_COLUMN_LAST_ROW = 25;
