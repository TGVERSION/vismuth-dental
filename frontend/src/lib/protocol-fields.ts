// Единственное место, где ИИ-функции привязаны к конкретным полям структуры
// протокола.
//
// Форма строится по структуре, которую пользователь редактирует в настройках,
// но подбор кода МКБ-10 и проверка полноты жалоб включаются по имени поля.
// Имя генерируется из подписи, поэтому у структуры, созданной врачом, оно
// почти никогда не совпадает с ожидаемым: подпись «Жалобы» даёт имя
// `zhaloby`, а не `complaints`, и помощник молча не работал.
//
// Правильное решение — признак роли поля в самой структуре
// (`protocol_structures_fields`). Пока его нет, роль определяется двумя
// способами: по известному имени поля и, как запасной вариант, по подписи.
// Сопоставление собрано здесь: менять его нужно в одном файле.
//
// Внешняя зависимость: добавить роль поля в схему структуры протокола
// (задача F-3.1 в плане доработок).

/** Поля, для которых работает проверка полноты жалоб. */
const COMPLAINTS_FIELD_NAMES = ['complaints', 'chief_complaint'];

/** Поля, которые отрисовываются вводом диагноза с подбором кода МКБ-10. */
const MAIN_DIAGNOSIS_FIELD_NAMES = ['main_diagnosis'];

/**
 * Подпись поля для сравнения: нижний регистр, без знаков препинания,
 * одиночные пробелы.
 */
const normalizeLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Жалобы узнаём по основе слова: подходят «Жалобы», «Жалобы пациента»,
 * «Жалобы при поступлении».
 */
const COMPLAINTS_LABEL_STEM = 'жалоб';

/**
 * Для диагноза сравниваем подпись целиком, а не по основе: «Сопутствующий
 * диагноз» и «Диагноз по МКБ» — это другие поля, и подменять им способ ввода
 * нельзя.
 */
const MAIN_DIAGNOSIS_LABELS = [
  'диагноз',
  'основной диагноз',
  'диагноз основной',
  'клинический диагноз',
];

export const isComplaintsField = (
  sectionKey: string,
  fieldLabel?: string | null,
): boolean => {
  if (COMPLAINTS_FIELD_NAMES.includes(sectionKey)) return true;
  if (!fieldLabel) return false;
  return normalizeLabel(fieldLabel).startsWith(COMPLAINTS_LABEL_STEM);
};

export const isMainDiagnosisField = (
  sectionKey: string,
  fieldLabel?: string | null,
): boolean => {
  if (MAIN_DIAGNOSIS_FIELD_NAMES.includes(sectionKey)) return true;
  if (!fieldLabel) return false;
  return MAIN_DIAGNOSIS_LABELS.includes(normalizeLabel(fieldLabel));
};

/**
 * Имя поля, под которым события диагноза уходят в ML-статистику.
 * Бэкенд группирует статистику именно по нему, поэтому значение фиксированное
 * и не зависит от того, как поле названо в конкретной структуре.
 */
export const ML_MAIN_DIAGNOSIS_FIELD_NAME = 'main_diagnosis';

/** Раздел, который считается активным до загрузки структуры протокола. */
export const DEFAULT_ACTIVE_SECTION = COMPLAINTS_FIELD_NAMES[0];

/**
 * Найти в списке разделов тот, что играет роль основного диагноза.
 * Используется для кнопки проверки по клиническим рекомендациям.
 */
export const findMainDiagnosisValue = (
  sections: { sectionKey: string; value: string; label?: string }[],
): string | undefined =>
  sections.find((section) =>
    isMainDiagnosisField(section.sectionKey, section.label),
  )?.value;
