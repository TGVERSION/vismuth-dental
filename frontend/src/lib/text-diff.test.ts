import { describe, it, expect } from 'vitest';
import { diffText, tokenize, type DiffSegment } from './text-diff';

const join = (segments: DiffSegment[]) => segments.map((s) => s.text).join('');
const changed = (segments: DiffSegment[]) =>
  segments.filter((s) => s.changed).map((s) => s.text);

describe('tokenize', () => {
  it('держит числа с разделителями одним токеном', () => {
    expect(tokenize('48–72 часа, разд. 3.1')).toEqual([
      '48–72',
      ' ',
      'часа',
      ',',
      ' ',
      'разд',
      '.',
      ' ',
      '3.1',
    ]);
  });

  it('держит слово через дефис одним токеном, перевод строки — отдельным', () => {
    expect(tokenize('С-реактивный\nбелок')).toEqual([
      'С-реактивный',
      '\n',
      'белок',
    ]);
  });
});

describe('diffText', () => {
  // Пример из дизайна PL-314.
  it('выделяет вставки внутри строки целыми фрагментами', () => {
    const diff = diffText(
      'Лизиноприл 10 мг утром',
      'Лизиноприл 10 мг внутрь 1 раз в сутки утром, постоянно.',
    );

    expect(diff.after).toEqual([
      { text: 'Лизиноприл 10 мг ', changed: false },
      { text: 'внутрь 1 раз в сутки', changed: true },
      { text: ' утром', changed: false },
      { text: ', постоянно.', changed: true },
    ]);
    expect(diff.before).toEqual([
      { text: 'Лизиноприл 10 мг утром', changed: false },
    ]);
  });

  it('выделяет текст, дописанный врачом, как новое', () => {
    const diff = diffText(
      'Лизиноприл 10 мг утром',
      'Лизиноприл 10 мг внутрь 1 раз в сутки утром, постоянно. Контроль АД ежедневно',
    );

    expect(changed(diff.after)).toEqual([
      'внутрь 1 раз в сутки',
      ', постоянно. Контроль АД ежедневно',
    ]);
  });

  it('показывает замену: убранное в прежнем тексте, новое — в новом', () => {
    const diff = diffText(
      'Амоксициллин 1000 мг 7 дней',
      'Амоксициллин 500 мг 7 дней',
    );

    expect(changed(diff.before)).toEqual(['1000']);
    expect(changed(diff.after)).toEqual(['500']);
  });

  it('не выделяет переводы строк и пробелы по краям вставки', () => {
    const diff = diffText(
      'ОАК\nСРБ',
      'ОАК — оценка воспаления (КР, разд. 2.3)\nСРБ',
    );

    expect(changed(diff.after)).toEqual([
      '— оценка воспаления (КР, разд. 2.3)',
    ]);
    expect(join(diff.after)).toBe(
      'ОАК — оценка воспаления (КР, разд. 2.3)\nСРБ',
    );
  });

  it('выделяет добавленную строку целиком', () => {
    const diff = diffText('ОАК\nСРБ', 'ОАК\nРентгенография ОГК\nСРБ');

    expect(changed(diff.after)).toEqual(['Рентгенография ОГК']);
  });

  it('ничего не выделяет у одинаковых текстов', () => {
    const diff = diffText('Постельный режим', 'Постельный режим');

    expect(changed(diff.after)).toEqual([]);
    expect(changed(diff.before)).toEqual([]);
  });

  it('работает с пустыми строками', () => {
    expect(diffText('', 'Новый текст')).toEqual({
      before: [],
      after: [{ text: 'Новый текст', changed: true }],
    });
    expect(diffText('Старый текст', '')).toEqual({
      before: [{ text: 'Старый текст', changed: true }],
      after: [],
    });
  });

  it('склеенные фрагменты дают исходные тексты', () => {
    const original =
      'Контроль ОАК и СРБ через 48–72 часа\nПовторный приём через 3 дня';
    const next =
      'Контроль ОАК и СРБ через 48–72 часа для оценки ответа на терапию\nПовторный приём терапевта через 3 дня';
    const diff = diffText(original, next);

    expect(join(diff.before)).toBe(original);
    expect(join(diff.after)).toBe(next);
  });

  // Большой раздел: по словам таблица вышла бы больше предела, сравнение
  // идёт по строкам и всё равно находит вставленную строку.
  it('для больших текстов переходит на сравнение по строкам', () => {
    const lines = Array.from(
      { length: 400 },
      (_, i) => `Назначение номер ${i} по схеме`,
    );
    const original = lines.join('\n');
    const next = [
      ...lines.slice(0, 200),
      'Новая строка',
      ...lines.slice(200),
    ].join('\n');

    expect(tokenize(original).length * tokenize(next).length).toBeGreaterThan(
      1_500_000,
    );
    const diff = diffText(original, next);

    expect(changed(diff.after)).toEqual(['Новая строка']);
    expect(join(diff.after)).toBe(next);
  });
});
