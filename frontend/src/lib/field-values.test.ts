import { describe, it, expect } from 'vitest';
import {
  formatMultiValue,
  parseMultiValue,
  toggleMultiValue,
} from './field-values';

describe('parseMultiValue', () => {
  it('разбирает простое значение без справочника', () => {
    expect(parseMultiValue('Кашель, Насморк')).toEqual(['Кашель', 'Насморк']);
  });

  it('возвращает пустой список для пустого значения', () => {
    expect(parseMultiValue('')).toEqual([]);
    expect(parseMultiValue('   ')).toEqual([]);
  });

  // Главный случай, ради которого писалась функция: медицинские формулировки
  // содержат запятые, и наивный split разваливал их на несуществующие варианты.
  it('не разваливает варианты, внутри которых есть запятые', () => {
    const options = [
      'Гипертоническая болезнь II ст., риск 3',
      'Сахарный диабет 2 типа',
    ];
    const stored = formatMultiValue(options);

    expect(parseMultiValue(stored, options)).toEqual(options);
  });

  it('различает вариант и вариант, начинающийся так же', () => {
    const options = ['Диабет', 'Диабет 2 типа'];

    expect(parseMultiValue('Диабет 2 типа', options)).toEqual(['Диабет 2 типа']);
    expect(parseMultiValue('Диабет', options)).toEqual(['Диабет']);
  });

  it('сохраняет порядок вариантов справочника, а не порядок в строке', () => {
    const options = ['Первый', 'Второй', 'Третий'];

    expect(parseMultiValue('Третий, Первый', options)).toEqual([
      'Первый',
      'Третий',
    ]);
  });

  it('падает на разбор по запятой, если значение собрано не из справочника', () => {
    const options = ['Кашель', 'Насморк'];

    expect(parseMultiValue('Одышка, Слабость', options)).toEqual([
      'Одышка',
      'Слабость',
    ]);
  });
});

describe('formatMultiValue', () => {
  it('склеивает варианты через запятую с пробелом', () => {
    expect(formatMultiValue(['А', 'Б'])).toBe('А, Б');
  });

  it('переживает круговой обход через parseMultiValue', () => {
    const options = ['Боль в груди, давящая', 'Одышка при нагрузке'];
    const stored = formatMultiValue(options);

    expect(parseMultiValue(stored, options)).toEqual(options);
  });
});

describe('toggleMultiValue', () => {
  const options = ['Первый', 'Второй', 'Третий'];

  it('добавляет вариант в порядке справочника', () => {
    expect(toggleMultiValue(['Третий'], 'Первый', true, options)).toEqual([
      'Первый',
      'Третий',
    ]);
  });

  it('убирает вариант', () => {
    expect(
      toggleMultiValue(['Первый', 'Третий'], 'Первый', false, options),
    ).toEqual(['Третий']);
  });

  it('не теряет значения, которых нет в справочнике', () => {
    const result = toggleMultiValue(['Своё'], 'Второй', true, options);

    expect(result).toContain('Своё');
    expect(result).toContain('Второй');
  });
});
