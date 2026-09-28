import { describe, expect, it } from 'vitest';
import {
  buildCalendarMonths,
  formatDateLabel,
  formatDayMonth,
} from './calendar';

describe('buildCalendarMonths', () => {
  it('покрывает все месяцы диапазона', () => {
    const months = buildCalendarMonths('2026-09-21', '2026-10-21');
    expect(months.map((m) => m.title)).toEqual(['Сентябрь', 'Октябрь']);
  });

  it('ставит первое число под его день недели', () => {
    // 1 сентября 2026 — вторник, значит перед ним одна пустая клетка.
    const [september] = buildCalendarMonths('2026-09-21', '2026-09-30');
    const lead = september.days.findIndex((day) => day !== null);
    expect(lead).toBe(1);
    expect(september.days[1]).toMatchObject({ day: 1, date: '2026-09-01' });
  });

  it('показывает месяц целиком, но закрывает дни вне диапазона', () => {
    const [september] = buildCalendarMonths('2026-09-21', '2026-10-21');
    const days = september.days.filter((day) => day !== null);

    expect(days).toHaveLength(30);
    expect(days.find((d) => d!.date === '2026-09-20')!.disabled).toBe(true);
    expect(days.find((d) => d!.date === '2026-09-21')!.disabled).toBe(false);
    expect(days.find((d) => d!.date === '2026-09-30')!.disabled).toBe(false);
  });

  it('закрывает дни после верхней границы', () => {
    const months = buildCalendarMonths('2026-09-21', '2026-10-21');
    const october = months[1].days.filter((day) => day !== null);

    expect(october.find((d) => d!.date === '2026-10-21')!.disabled).toBe(false);
    expect(october.find((d) => d!.date === '2026-10-22')!.disabled).toBe(true);
  });

  it('переходит через границу года и добавляет год к названию', () => {
    const months = buildCalendarMonths('2026-12-20', '2027-01-19');
    expect(months.map((m) => m.title)).toEqual(['Декабрь', 'Январь 2027']);
  });

  it('учитывает високосный февраль', () => {
    const [february] = buildCalendarMonths('2028-02-01', '2028-02-29');
    expect(february.days.filter((day) => day !== null)).toHaveLength(29);
  });
});

describe('formatDateLabel', () => {
  it('выводит дату в родительном падеже', () => {
    expect(formatDateLabel('2026-09-21')).toBe('21 сентября 2026');
    expect(formatDateLabel('2027-01-01')).toBe('1 января 2027');
  });

  it('на пустом и битом значении возвращает пустую строку', () => {
    expect(formatDateLabel('')).toBe('');
    expect(formatDateLabel('не дата')).toBe('');
  });
});

describe('formatDayMonth', () => {
  const today = new Date(2026, 8, 27);

  it('опускает текущий год', () => {
    expect(formatDayMonth('2026-10-05', today)).toBe('5 октября');
  });

  it('добавляет год, если он не текущий', () => {
    expect(formatDayMonth('2027-01-01', today)).toBe('1 января 2027');
    expect(formatDayMonth('2025-12-31', today)).toBe('31 декабря 2025');
  });

  it('на пустом и битом значении возвращает пустую строку', () => {
    expect(formatDayMonth('', today)).toBe('');
    expect(formatDayMonth('не дата', today)).toBe('');
  });
});
