// Лист А4 для подписи пациента — бланк «Анкета о здоровье» (МК Дент),
// заполненный его ответами. Длинные сведения печатаются на продолжении.
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
  continuation: { label: string; text: string }[];
}

// Ограничиваем только представление на основном листе. Полный ответ
// сохраняется на подписываемом продолжении, исходные данные не меняются.
const INLINE_NOTE_LIMIT = 150;
const INLINE_MORE_LIMIT = 260;
const CONTINUED = 'См. лист продолжения';

const withContinuation = (form: DentalPaperForm) => {
  const continuation: PrintSheet['continuation'] = [];
  const place = (text: string, label: string, limit: number): string => {
    if (text.length <= limit && text.split('\n').length < 4) return text;
    continuation.push({ label, text });
    return CONTINUED;
  };
  const rows = form.rows.map((row) => ({
    ...row,
    note: place(
      row.note,
      `Пункт ${row.number}. ${row.note_label ?? row.text}`,
      INLINE_NOTE_LIMIT,
    ),
    subs: row.subs.map((sub) => ({
      ...sub,
      note: place(
        sub.note,
        `Пункт ${row.number}. ${sub.text}`,
        INLINE_NOTE_LIMIT,
      ),
    })),
  }));
  const more = place(
    form.more,
    'Дополнительные сведения пациента',
    INLINE_MORE_LIMIT,
  );
  return { form: { ...form, rows, more }, continuation };
};

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
    ...withContinuation(form),
  };
};

/** Последняя строка левого столбца — как конец первой страницы бумажного бланка. */
export const FIRST_COLUMN_LAST_ROW = 25;
