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
