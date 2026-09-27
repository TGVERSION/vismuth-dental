import { describe, it, expect } from 'vitest';
import {
  extractDictEntries,
  getTypeLabel,
  isOptionsType,
  parseOptions,
  serializeOptions,
  slugify,
  type LocalOption,
} from './field-model';

const option = (text: string, isDefault = false): LocalOption => ({
  localId: `id-${text}`,
  text,
  isDefault,
});

describe('slugify', () => {
  // Регрессия: `\w` в регулярном выражении понимает только латиницу, поэтому
  // до транслитерации подпись «Жалобы пациента» давала имя поля «_», а все
  // русские названия структур — один и тот же код «_».
  it('транслитерирует кириллическую подпись', () => {
    expect(slugify('Жалобы пациента')).toBe('zhaloby_patsienta');
  });

  it('разные русские подписи дают разные имена', () => {
    expect(slugify('Анамнез заболевания')).not.toBe(slugify('Жалобы'));
  });

  it('выбрасывает знаки препинания', () => {
    expect(slugify('Диагноз (основной)!')).toBe('diagnoz_osnovnoy');
  });

  it('не оставляет подчёркиваний по краям и подряд', () => {
    expect(slugify('  Жалобы   пациента  ')).toBe('zhaloby_patsienta');
  });

  it('латиницу оставляет как есть', () => {
    expect(slugify('Main diagnosis')).toBe('main_diagnosis');
  });

  it('не возвращает пустое имя', () => {
    expect(slugify('!!!')).toMatch(/^field_\d+$/);
    expect(slugify('')).toMatch(/^field_\d+$/);
  });

  it('ограничивает длину', () => {
    expect(slugify('а'.repeat(200)).length).toBeLessThanOrEqual(100);
  });
});

describe('isOptionsType', () => {
  it('к полям с вариантами относит radio и checkbox', () => {
    expect(isOptionsType('radio')).toBe(true);
    expect(isOptionsType('checkbox')).toBe(true);
  });

  it('текстовое поле и списки вариантов не имеют', () => {
    expect(isOptionsType('text')).toBe(false);
    expect(isOptionsType('select')).toBe(false);
  });
});

describe('getTypeLabel', () => {
  it('переводит известный тип', () => {
    expect(getTypeLabel('text')).toBe('Текст');
  });

  it('неизвестный тип отдаёт как есть', () => {
    expect(getTypeLabel('unknown_type')).toBe('unknown_type');
  });
});

describe('parseOptions', () => {
  it('пустой ввод даёт пустой список', () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions({})).toEqual([]);
    expect(parseOptions('строка')).toEqual([]);
  });

  it('читает варианты и одно значение по умолчанию', () => {
    const result = parseOptions(
      { options: ['Да', 'Нет'], default: 'Нет' },
      'radio',
    );

    expect(result.map((o) => o.text)).toEqual(['Да', 'Нет']);
    expect(result.map((o) => o.isDefault)).toEqual([false, true]);
  });

  // У checkbox значений по умолчанию может быть несколько.
  it('читает несколько значений по умолчанию у checkbox', () => {
    const result = parseOptions(
      { options: ['А', 'Б', 'В'], defaults: ['А', 'В'] },
      'checkbox',
    );

    expect(result.map((o) => o.isDefault)).toEqual([true, false, true]);
  });

  it('выдаёт уникальные localId', () => {
    const result = parseOptions({ options: ['А', 'Б'] });
    expect(result[0].localId).not.toBe(result[1].localId);
  });
});

describe('serializeOptions', () => {
  it('пустой список превращает в null', () => {
    expect(serializeOptions([])).toBeNull();
  });

  it('собирает варианты с одним значением по умолчанию', () => {
    expect(serializeOptions([option('Да'), option('Нет', true)], 'radio')).toEqual(
      { options: ['Да', 'Нет'], default: 'Нет' },
    );
  });

  it('без выбранного значения по умолчанию отдаёт null', () => {
    expect(serializeOptions([option('Да')], 'radio')).toEqual({
      options: ['Да'],
      default: null,
    });
  });

  it('собирает несколько значений по умолчанию у checkbox', () => {
    expect(
      serializeOptions(
        [option('А', true), option('Б'), option('В', true)],
        'checkbox',
      ),
    ).toEqual({ options: ['А', 'Б', 'В'], defaults: ['А', 'В'] });
  });

  it('у checkbox без отмеченных вариантов defaults равен null', () => {
    expect(serializeOptions([option('А')], 'checkbox')).toEqual({
      options: ['А'],
      defaults: null,
    });
  });

  it('переживает круговой обход parse → serialize', () => {
    const stored = { options: ['А', 'Б', 'В'], defaults: ['Б'] };
    const roundTrip = serializeOptions(
      parseOptions(stored, 'checkbox'),
      'checkbox',
    );

    expect(roundTrip).toEqual(stored);
  });
});

describe('extractDictEntries', () => {
  it('пустой ответ даёт пустой список', () => {
    expect(extractDictEntries([])).toEqual([]);
  });

  it('берёт первую неслужебную текстовую колонку', () => {
    const result = extractDictEntries([
      { row_id: 1, code: 100, name: 'Аллергия' },
      { row_id: 2, code: 200, name: 'Отёк' },
    ]);

    expect(result).toEqual([
      { value: 'Аллергия', label: 'Аллергия' },
      { value: 'Отёк', label: 'Отёк' },
    ]);
  });

  it('пропускает пустые значения', () => {
    const result = extractDictEntries([{ name: 'Есть' }, { name: '' }]);
    expect(result).toHaveLength(1);
  });
});
