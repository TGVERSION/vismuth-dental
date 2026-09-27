// Разбор и сборка значений полей с множественным выбором.
//
// Сервер хранит значение поля строкой, поэтому несколько выбранных вариантов
// склеиваются через запятую. Медицинские формулировки сами содержат запятые
// («Гипертоническая болезнь II ст., риск 3»), и наивный split разваливал такое
// значение на несуществующие варианты — отмеченные галочки пропадали.
//
// Пока формат хранения не согласован с backend (задача F-3.2), разбираем
// значение по известному списку вариантов: сначала пытаемся собрать его из
// целых вариантов справочника и только при неудаче падаем на split по запятой.

const SEPARATOR = ', ';

/** Собрать значение поля из выбранных вариантов. */
export const formatMultiValue = (values: string[]): string =>
  values.join(SEPARATOR);

/**
 * Разобрать значение поля на выбранные варианты.
 *
 * `options` — известные варианты (из справочника или из структуры). Если они
 * заданы, значение разбирается по ним, что переживает запятые внутри вариантов.
 */
export const parseMultiValue = (
  value: string,
  options: string[] = [],
): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (options.length > 0) {
    const matched = matchByOptions(trimmed, options);
    if (matched) return matched;
  }

  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

/**
 * Разобрать строку по известным вариантам. Длинные варианты проверяются
 * первыми, иначе «Диабет» съел бы начало «Диабет 2 типа». Возвращает null,
 * если строку не удалось разложить целиком, — значит, значение пришло не из
 * этого списка и разбирать его по нему нельзя.
 */
const matchByOptions = (value: string, options: string[]): string[] | null => {
  const byLengthDesc = [...options].sort((a, b) => b.length - a.length);
  const selected: string[] = [];
  let rest = value;

  while (rest.length > 0) {
    const option = byLengthDesc.find((candidate) => rest.startsWith(candidate));
    if (!option) return null;

    selected.push(option);
    rest = rest.slice(option.length).trim();

    if (rest.startsWith(',')) {
      rest = rest.slice(1).trim();
    } else if (rest.length > 0) {
      // Дальше идёт текст, не отделённый запятой, — значение собрано не из
      // этих вариантов.
      return null;
    }
  }

  // Порядок возвращаем в порядке списка вариантов, а не в порядке строки:
  // так галочки не «прыгают» при перерисовке.
  return options.filter((option) => selected.includes(option));
};

/** Добавить или убрать вариант, сохранив порядок списка вариантов. */
export const toggleMultiValue = (
  current: string[],
  option: string,
  checked: boolean,
  options: string[],
): string[] => {
  const next = checked
    ? [...current, option]
    : current.filter((item) => item !== option);

  const known = options.filter((item) => next.includes(item));
  const unknown = next.filter((item) => !options.includes(item));
  return [...known, ...unknown];
};
