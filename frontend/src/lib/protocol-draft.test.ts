import { describe, it, expect } from 'vitest';
import {
  buildFieldValues,
  buildSectionsFromStructure,
  computeChangedValues,
  hasMorePages,
  isFieldMappingBroken,
  serializeDraft,
  shouldFlushOnLeave,
  type DraftSection,
} from './protocol-draft';
import type { ProtocolStructuresFields, StructureProtocolsFields } from '@/api';

const field = (
  over: Partial<StructureProtocolsFields> & { id: string; field_name: string },
): StructureProtocolsFields =>
  ({
    field_label: over.field_name,
    field_type: 'text',
    default_value: '',
    sort_order: 0,
    ...over,
  }) as StructureProtocolsFields;

const structure = (
  fields: StructureProtocolsFields[],
): ProtocolStructuresFields =>
  ({ id: 's1', structure_name: 'Тест', fields }) as ProtocolStructuresFields;

const section = (over: Partial<DraftSection>): DraftSection => ({
  id: 1,
  label: 'Раздел',
  value: '',
  sectionKey: 'key',
  ...over,
});

describe('buildSectionsFromStructure', () => {
  it('сортирует разделы по sort_order', () => {
    const result = buildSectionsFromStructure(
      structure([
        field({ id: 'b', field_name: 'second', sort_order: 2 }),
        field({ id: 'a', field_name: 'first', sort_order: 1 }),
      ]),
    );

    expect(result.map((s) => s.sectionKey)).toEqual(['first', 'second']);
  });

  // Регрессия: раньше сортировка шла на месте и меняла массив в Zustand-сторе.
  it('не меняет исходный массив полей', () => {
    const fields = [
      field({ id: 'b', field_name: 'second', sort_order: 2 }),
      field({ id: 'a', field_name: 'first', sort_order: 1 }),
    ];
    const before = fields.map((f) => f.id);

    buildSectionsFromStructure(structure(fields));

    expect(fields.map((f) => f.id)).toEqual(before);
  });

  it('подставляет значение по умолчанию', () => {
    const result = buildSectionsFromStructure(
      structure([
        field({ id: 'a', field_name: 'first', default_value: 'Готовый текст' }),
      ]),
    );

    expect(result[0].value).toBe('Готовый текст');
  });
});

describe('buildFieldValues', () => {
  it('раскладывает значения по UUID полей структуры', () => {
    const result = buildFieldValues([
      section({ sectionKey: 'a', value: 'Текст', fieldMeta: field({ id: 'uuid-a', field_name: 'a' }) }),
    ]);

    expect(result).toEqual({ 'uuid-a': 'Текст' });
  });

  it('пропускает разделы без метаданных структуры', () => {
    const result = buildFieldValues([
      section({ sectionKey: 'a', value: 'Есть', fieldMeta: field({ id: 'uuid-a', field_name: 'a' }) }),
      section({ id: 2, sectionKey: 'b', value: 'Некуда сохранять' }),
    ]);

    expect(result).toEqual({ 'uuid-a': 'Есть' });
  });
});

describe('isFieldMappingBroken', () => {
  // Защита от затирания: пустой field_values при непустом протоколе стёр бы
  // данные на сервере.
  it('считает поломкой непустой протокол без единого сопоставленного поля', () => {
    expect(isFieldMappingBroken([section({})], {})).toBe(true);
  });

  it('не считает поломкой пустой протокол', () => {
    expect(isFieldMappingBroken([], {})).toBe(false);
  });

  it('не считает поломкой нормальный случай', () => {
    expect(isFieldMappingBroken([section({})], { a: 'x' })).toBe(false);
  });
});

describe('computeChangedValues', () => {
  it('возвращает только изменившиеся поля', () => {
    const changed = computeChangedValues(
      { a: 'новое', b: 'прежнее' },
      { a: 'старое', b: 'прежнее' },
    );

    expect(changed).toEqual({ a: 'новое' });
  });

  // Регрессия на находку N1: пустое обязательное поле, которого врач не
  // касался, не должно попадать в запрос и ронять сохранение.
  it('не включает нетронутое пустое поле', () => {
    const changed = computeChangedValues(
      { complaints: '', anamnesis: 'Заболел вчера' },
      { complaints: '', anamnesis: '' },
    );

    expect(changed).toEqual({ anamnesis: 'Заболел вчера' });
    expect(changed).not.toHaveProperty('complaints');
  });

  it('включает очистку поля', () => {
    expect(computeChangedValues({ a: '' }, { a: 'было' })).toEqual({ a: '' });
  });

  it('включает поле, которого сервер ещё не знает', () => {
    expect(computeChangedValues({ a: 'ново' }, {})).toEqual({ a: 'ново' });
  });

  it('возвращает пустой объект, когда ничего не менялось', () => {
    expect(computeChangedValues({ a: 'x' }, { a: 'x' })).toEqual({});
  });
});

describe('serializeDraft', () => {
  it('различает снимки с разным текстом', () => {
    const a = serializeDraft('Протокол', [section({ value: 'раз' })]);
    const b = serializeDraft('Протокол', [section({ value: 'два' })]);

    expect(a).not.toBe(b);
  });

  it('различает снимки с разным названием', () => {
    const a = serializeDraft('Первый', [section({})]);
    const b = serializeDraft('Второй', [section({})]);

    expect(a).not.toBe(b);
  });

  it('одинаковое состояние даёт одинаковый снимок', () => {
    expect(serializeDraft('П', [section({ value: 'x' })])).toBe(
      serializeDraft('П', [section({ value: 'x' })]),
    );
  });
});

describe('hasMorePages', () => {
  // Регрессия на находку H3: прежняя формула (page + 1) * size отбрасывала
  // последнюю неполную страницу.
  it('видит последнюю неполную страницу', () => {
    expect(hasMorePages(1, 20, 25)).toBe(true);
  });

  it('останавливается, когда всё загружено', () => {
    expect(hasMorePages(2, 20, 25)).toBe(false);
  });

  it('корректен на границе кратности', () => {
    expect(hasMorePages(1, 20, 20)).toBe(false);
    expect(hasMorePages(1, 20, 21)).toBe(true);
  });

  it('пустой справочник не просит следующую страницу', () => {
    expect(hasMorePages(1, 20, 0)).toBe(false);
  });
});

describe('shouldFlushOnLeave', () => {
  const ready = {
    protocolId: 'protocol-1',
    isLoading: false,
    hasToken: true,
    snapshot: 'изменено',
    lastSaved: 'сохранено',
  };

  it('досохраняет, когда все условия выполнены', () => {
    expect(shouldFlushOnLeave(ready)).toBe(true);
  });

  it('не досохраняет без открытого протокола', () => {
    expect(shouldFlushOnLeave({ ...ready, protocolId: null })).toBe(false);
  });

  it('не досохраняет во время загрузки протокола', () => {
    expect(shouldFlushOnLeave({ ...ready, isLoading: true })).toBe(false);
  });

  it('не досохраняет без токена — выход из аккаунта ведёт себя как раньше', () => {
    expect(shouldFlushOnLeave({ ...ready, hasToken: false })).toBe(false);
  });

  it('не досохраняет, когда изменений нет', () => {
    expect(
      shouldFlushOnLeave({ ...ready, snapshot: 'same', lastSaved: 'same' }),
    ).toBe(false);
  });
});
