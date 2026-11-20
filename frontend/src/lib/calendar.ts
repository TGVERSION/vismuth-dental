// Построение сетки календаря для выбора даты приёма.
//
// Даты представлены строками `YYYY-MM-DD`: в таком виде их принимает и
// отдаёт контракт анкеты, они сравниваются лексикографически, и с ними не
// возникает сдвигов часового пояса, которые даёт работа с Date напрямую.

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/** Заголовки столбцов: неделя начинается с понедельника. */
export const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  /** Вне допустимого диапазона: выбрать нельзя. */
  disabled: boolean;
}

export interface CalendarMonth {
  title: string;
  /**
   * Клетки сетки по семь в ряд. `null` — пустая позиция до первого дня
   * месяца, чтобы первое число встало под свой день недели.
   */
  days: (CalendarDay | null)[];
}

const pad = (value: number): string => String(value).padStart(2, '0');

const parseDate = (value: string): { year: number; month: number } => {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
};

/** Число дней в месяце. `month` — от 1 до 12. */
const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

/** День недели первого числа, где 0 — понедельник. */
const firstWeekdayIndex = (year: number, month: number): number =>
  (new Date(year, month - 1, 1).getDay() + 6) % 7;

/**
 * Месяцы, покрывающие диапазон от `min` до `max` включительно.
 *
 * Месяц показывается целиком, а дни вне диапазона помечаются `disabled`:
 * так пациент видит привычную сетку, но выбрать может только разрешённое.
 * Год добавляется к названию только когда он отличается от года начала
 * диапазона — иначе подпись «Сентябрь 2026» была бы лишним шумом.
 */
export const buildCalendarMonths = (
  min: string,
  max: string,
): CalendarMonth[] => {
  const from = parseDate(min);
  const to = parseDate(max);
  const months: CalendarMonth[] = [];

  let year = from.year;
  let month = from.month;

  while (year < to.year || (year === to.year && month <= to.month)) {
    const total = daysInMonth(year, month);
    const lead = firstWeekdayIndex(year, month);
    const days: (CalendarDay | null)[] = Array.from(
      { length: lead },
      () => null,
    );

    for (let day = 1; day <= total; day += 1) {
      const date = `${year}-${pad(month)}-${pad(day)}`;
      days.push({ date, day, disabled: date < min || date > max });
    }

    months.push({
      title:
        year === from.year
          ? MONTH_NAMES[month - 1]
          : `${MONTH_NAMES[month - 1]} ${year}`,
      days,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

/** Человекочитаемая дата для поля: «21 сентября 2026». */
const MONTH_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export const formatDateLabel = (value: string): string => {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';

  return `${day} ${MONTH_GENITIVE[month - 1]} ${year}`;
};

/**
 * Дата без года, если он совпадает с текущим: «5 октября», иначе
 * «5 октября 2027». Пустое или битое значение — пустая строка.
 */
export const formatDayMonth = (
  value: string,
  today: Date = new Date(),
): string => {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';

  const dayMonth = `${day} ${MONTH_GENITIVE[month - 1]}`;
  return year === today.getFullYear() ? dayMonth : `${dayMonth} ${year}`;
};

/**
 * Дата цифрами для узкого поля: «06.07.2026». Пустое или битое значение —
 * пустая строка.
 */
export const formatDateNumeric = (value: string): string => {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';

  return `${pad(day)}.${pad(month)}.${String(year).padStart(4, '0')}`;
};

/** Ручной ввод с точками или без них, а также ISO-значение из автозаполнения. */
export const parseDateNumeric = (value: string): string => {
  const text = value.trim();
  const match =
    /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text) ??
    /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso.startsWith('0000-')) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : '';
};

/** Маска ручного ввода даты и позиция курсора после вставки разделителей. */
export const maskDateNumericInput = (
  value: string,
  cursor: number,
  deletingForward = false,
): { text: string; cursor: number } => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) return { text: `${iso[3]}.${iso[2]}.${iso[1]}`, cursor: 10 };

  const digits = value.replace(/\D/g, '').slice(0, 8);
  const text = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join('.');
  const digitsBefore = Math.min(
    digits.length,
    value.slice(0, cursor).replace(/\D/g, '').length,
  );
  const position =
    digitsBefore + Number(digitsBefore > 2) + Number(digitsBefore > 4);
  return {
    text,
    cursor: deletingForward && text[position] === '.' ? position + 1 : position,
  };
};
