import { describe, it, expect } from 'vitest';
import {
  appendText,
  applyVoiceFill,
  revertAllVoiceFill,
  revertVoiceFill,
} from './voice-fill';
import type { DraftSection } from './protocol-draft';
import type { StructureProtocolsFields } from '@/api';

const fieldMeta = (
  id: string,
  fieldType = 'text',
): StructureProtocolsFields => ({
  id,
  protocol_structure_id: 'structure-1',
  field_name: `field_${id}`,
  field_label: null,
  description: null,
  field_type: fieldType,
  default_value: null,
  default_value_jsonb: null,
  dictionary: null,
  protocol_fields_main_id: null,
  is_required: false,
  sort_order: 1,
});

const section = (
  id: number,
  value: string,
  fieldId: string | null = `uuid-${id}`,
  fieldType = 'text',
): DraftSection => ({
  id,
  label: `Раздел ${id}`,
  value,
  sectionKey: `section_${id}`,
  fieldMeta: fieldId ? fieldMeta(fieldId, fieldType) : undefined,
});

describe('applyVoiceFill', () => {
  it('заполняет пустое поле целиком', () => {
    const sections = [section(1, '')];

    const { sections: next, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Боли в правом подреберье, тошнота',
    });

    expect(next[0].value).toBe('Боли в правом подреберье, тошнота');
    expect(entries).toHaveLength(1);
    expect(entries[0].mode).toBe('fill');
    expect(entries[0].previous).toBe('');
  });

  // Главное правило модуля: текст, который врач набрал руками во время приёма,
  // не заменяется расшифровкой, а дополняется ею.
  it('дописывает в конец, а не затирает текст врача', () => {
    const sections = [section(1, 'Болен 3 дня')];

    const { sections: next, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Считает себя больным около трёх дней',
    });

    expect(next[0].value).toBe(
      'Болен 3 дня\n\nСчитает себя больным около трёх дней',
    );
    expect(entries[0].mode).toBe('append');
    expect(entries[0].previous).toBe('Болен 3 дня');
  });

  // «В приёме об этом не говорили» не должно означать «стереть написанное».
  it('не применяет пустое значение от сервера', () => {
    const sections = [section(1, 'Жалоб не предъявляет')];

    const { sections: next, entries } = applyVoiceFill(sections, {
      'uuid-1': '   ',
    });

    expect(next[0].value).toBe('Жалоб не предъявляет');
    expect(entries).toHaveLength(0);
  });

  it('не трогает поля, которых нет в ответе', () => {
    const sections = [section(1, 'Текст врача'), section(2, '')];

    const { sections: next, entries } = applyVoiceFill(sections, {
      'uuid-2': 'Из записи',
    });

    expect(next[0].value).toBe('Текст врача');
    expect(next[1].value).toBe('Из записи');
    expect(entries).toHaveLength(1);
  });

  it('пропускает нетекстовые поля', () => {
    const sections = [section(1, '', 'uuid-1', 'select')];

    const { sections: next, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Свободный текст из речи',
    });

    expect(next[0].value).toBe('');
    expect(entries).toHaveLength(0);
  });

  it('пропускает разделы без метаданных структуры', () => {
    const sections = [section(1, '', null)];

    const { entries } = applyVoiceFill(sections, { 'uuid-1': 'Из записи' });

    expect(entries).toHaveLength(0);
  });

  it('игнорирует неизвестные ключи полей', () => {
    const sections = [section(1, '')];

    const { entries } = applyVoiceFill(sections, {
      'uuid-неизвестный': 'Текст',
    });

    expect(entries).toHaveLength(0);
  });

  it('не мутирует входные разделы', () => {
    const sections = [section(1, 'Исходное')];
    const snapshot = JSON.stringify(sections);

    applyVoiceFill(sections, { 'uuid-1': 'Из записи' });

    expect(JSON.stringify(sections)).toBe(snapshot);
  });

  // Иначе поле подсветилось бы как «заполнено из записи», хотя не изменилось.
  it('не создаёт записи, если значение не изменилось', () => {
    const sections = [section(1, 'Один и тот же текст')];

    const { entries } = applyVoiceFill(sections, {
      'uuid-1': 'Один и тот же текст',
    });

    expect(entries).toHaveLength(0);
  });
});

describe('appendText', () => {
  it('разделяет тексты пустой строкой', () => {
    expect(appendText('Первый', 'Второй')).toBe('Первый\n\nВторой');
  });

  it('обходится без разделителя, когда одна из частей пуста', () => {
    expect(appendText('', 'Только из записи')).toBe('Только из записи');
    expect(appendText('Только врач', '  ')).toBe('Только врач');
  });

  it('не дублирует уже дописанный текст', () => {
    const merged = appendText('Врач', 'Запись');

    expect(appendText(merged, 'Запись')).toBe(merged);
  });
});

describe('revertVoiceFill', () => {
  it('возвращает ровно прежнее значение', () => {
    const sections = [section(1, 'Текст врача'), section(2, '')];
    const { sections: filled, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Из записи',
      'uuid-2': 'Тоже из записи',
    });

    const reverted = revertVoiceFill(filled, entries[0]);

    expect(reverted[0].value).toBe('Текст врача');
    // Второе поле откатывать не просили — оно остаётся заполненным.
    expect(reverted[1].value).toBe('Тоже из записи');
  });

  // Страховка на случай ошибки вызывающего кода: если врач успел поправить
  // поле после применения, откат не имеет права стереть его правку.
  it('не откатывает поле, изменённое врачом после применения', () => {
    const sections = [section(1, 'Текст врача')];
    const { sections: filled, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Из записи',
    });
    const edited = filled.map((item) => ({
      ...item,
      value: 'Правка врача после применения',
    }));

    const reverted = revertVoiceFill(edited, entries[0]);

    expect(reverted[0].value).toBe('Правка врача после применения');
  });

  it('идемпотентен при повторном откате', () => {
    const sections = [section(1, 'Текст врача')];
    const { sections: filled, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Из записи',
    });

    const once = revertVoiceFill(filled, entries[0]);
    const twice = revertVoiceFill(once, entries[0]);

    expect(twice[0].value).toBe('Текст врача');
  });
});

describe('revertAllVoiceFill', () => {
  it('откатывает все перечисленные поля', () => {
    const sections = [section(1, 'Врач писал'), section(2, '')];
    const { sections: filled, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Из записи 1',
      'uuid-2': 'Из записи 2',
    });

    const reverted = revertAllVoiceFill(filled, entries);

    expect(reverted.map((item) => item.value)).toEqual(['Врач писал', '']);
  });

  // Поле, которое врач правил после применения, вызывающий код исключает из
  // списка записей — и откат его не касается.
  it('не трогает поля, записи о которых не переданы', () => {
    const sections = [section(1, 'Врач писал'), section(2, '')];
    const { sections: filled, entries } = applyVoiceFill(sections, {
      'uuid-1': 'Из записи 1',
      'uuid-2': 'Из записи 2',
    });
    const edited = filled.map((item) =>
      item.id === 2
        ? { ...item, value: 'Правка врача после применения' }
        : item,
    );

    const reverted = revertAllVoiceFill(
      edited,
      entries.filter((entry) => entry.sectionId !== 2),
    );

    expect(reverted[0].value).toBe('Врач писал');
    expect(reverted[1].value).toBe('Правка врача после применения');
  });
});
