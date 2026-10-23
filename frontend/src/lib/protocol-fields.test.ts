import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTIVE_SECTION,
  findDmsTargetSections,
  findMainDiagnosisSection,
  findMainDiagnosisValue,
  isComplaintsField,
  isMainDiagnosisField,
  isPrescriptionsField,
  isRecommendationsField,
} from './protocol-fields';

describe('isComplaintsField', () => {
  it('узнаёт поля жалоб по имени', () => {
    expect(isComplaintsField('complaints')).toBe(true);
    expect(isComplaintsField('chief_complaint')).toBe(true);
  });

  it('не срабатывает на других полях', () => {
    expect(isComplaintsField('disease_anamnesis')).toBe(false);
    expect(isComplaintsField('')).toBe(false);
  });

  // Регрессия: у структуры, созданной врачом, имя поля генерируется из
  // подписи и не совпадает с `complaints`, из-за чего проверка полноты
  // молча не работала.
  it('узнаёт жалобы по подписи, когда имя поля другое', () => {
    expect(isComplaintsField('zhaloby', 'Жалобы')).toBe(true);
    expect(isComplaintsField('field_1', 'Жалобы пациента')).toBe(true);
    expect(isComplaintsField('_', 'Жалобы при поступлении')).toBe(true);
  });

  it('подпись сравнивается без учёта регистра и пунктуации', () => {
    expect(isComplaintsField('x', '  ЖАЛОБЫ:  ')).toBe(true);
  });

  it('не принимает за жалобы посторонние подписи', () => {
    expect(isComplaintsField('x', 'Анамнез заболевания')).toBe(false);
    expect(isComplaintsField('x', 'Объективный статус')).toBe(false);
    expect(isComplaintsField('x', '')).toBe(false);
  });
});

describe('isMainDiagnosisField', () => {
  it('узнаёт поле основного диагноза по имени', () => {
    expect(isMainDiagnosisField('main_diagnosis')).toBe(true);
  });

  it('не срабатывает на похожих именах', () => {
    expect(isMainDiagnosisField('diagnosis')).toBe(false);
    expect(isMainDiagnosisField('main_diagnosis_extra')).toBe(false);
  });

  it('узнаёт диагноз по подписи, когда имя поля другое', () => {
    expect(isMainDiagnosisField('diagnoz', 'Диагноз')).toBe(true);
    expect(isMainDiagnosisField('x', 'Основной диагноз')).toBe(true);
    expect(isMainDiagnosisField('x', 'Клинический диагноз')).toBe(true);
  });

  // Подпись диагноза сравнивается целиком, а не по основе: подменять способ
  // ввода соседним полям нельзя.
  it('не принимает за основной диагноз другие поля с этим словом', () => {
    expect(isMainDiagnosisField('x', 'Сопутствующий диагноз')).toBe(false);
    expect(isMainDiagnosisField('x', 'Диагноз по МКБ-10')).toBe(false);
    expect(isMainDiagnosisField('x', 'Обоснование диагноза')).toBe(false);
  });
});

describe('findMainDiagnosisValue', () => {
  it('находит значение поля диагноза среди разделов', () => {
    const value = findMainDiagnosisValue([
      { sectionKey: 'complaints', value: 'Кашель' },
      { sectionKey: 'main_diagnosis', value: 'J06.9 – ОРВИ' },
    ]);

    expect(value).toBe('J06.9 – ОРВИ');
  });

  it('находит диагноз по подписи, когда имя поля другое', () => {
    const value = findMainDiagnosisValue([
      { sectionKey: 'zhaloby', value: 'Кашель', label: 'Жалобы' },
      { sectionKey: 'diagnoz', value: 'J06.9 – ОРВИ', label: 'Диагноз' },
    ]);

    expect(value).toBe('J06.9 – ОРВИ');
  });

  it('возвращает undefined, если такого поля в структуре нет', () => {
    expect(
      findMainDiagnosisValue([{ sectionKey: 'complaints', value: 'Кашель' }]),
    ).toBeUndefined();
  });

  it('возвращает пустую строку для незаполненного диагноза', () => {
    expect(
      findMainDiagnosisValue([{ sectionKey: 'main_diagnosis', value: '' }]),
    ).toBe('');
  });
});

describe('isRecommendationsField / isPrescriptionsField', () => {
  it('узнают поля по имени', () => {
    expect(isRecommendationsField('recommendations')).toBe(true);
    expect(isPrescriptionsField('prescriptions')).toBe(true);
  });

  it('узнают поля по подписи, когда имя другое', () => {
    expect(isRecommendationsField('rekomendatsii', 'Рекомендации')).toBe(true);
    expect(isRecommendationsField('x', 'Рекомендации пациенту')).toBe(true);
    expect(isPrescriptionsField('naznacheniya', 'Назначения')).toBe(true);
    expect(isPrescriptionsField('x', 'Назначено:')).toBe(true);
  });

  it('не путают разделы между собой и с другими полями', () => {
    expect(isRecommendationsField('x', 'Назначения')).toBe(false);
    expect(isPrescriptionsField('x', 'Рекомендации')).toBe(false);
    expect(isPrescriptionsField('x', 'Диагноз')).toBe(false);
    expect(isRecommendationsField('x', 'Клинические рекомендации')).toBe(false);
    expect(isRecommendationsField('x', '')).toBe(false);
  });
});

describe('findDmsTargetSections', () => {
  const text = { field_type: 'text' };

  it('возвращает текстовые разделы рекомендаций и назначений в порядке формы', () => {
    const sections = [
      { sectionKey: 'naznacheniya', label: 'Назначения', fieldMeta: text },
      { sectionKey: 'complaints', label: 'Жалобы', fieldMeta: text },
      { sectionKey: 'recommendations', label: 'Рекомендации' },
    ];

    expect(findDmsTargetSections(sections).map((s) => s.sectionKey)).toEqual([
      'naznacheniya',
      'recommendations',
    ]);
  });

  it('пропускает нетекстовые поля с подходящей подписью', () => {
    const sections = [
      {
        sectionKey: 'prescriptions',
        label: 'Назначения',
        fieldMeta: { field_type: 'multiselect' },
      },
    ];

    expect(findDmsTargetSections(sections)).toEqual([]);
  });

  it('считает текстовым поле без типа, как SectionInput', () => {
    const sections = [
      { sectionKey: 'x', label: 'Назначения', fieldMeta: { field_type: null } },
    ];

    expect(findDmsTargetSections(sections)).toHaveLength(1);
  });
});

describe('findMainDiagnosisSection', () => {
  it('возвращает сам раздел, а не только значение', () => {
    const diagnosis = { sectionKey: 'main_diagnosis', value: 'J06.9 – ОРВИ' };

    expect(
      findMainDiagnosisSection([
        { sectionKey: 'complaints', value: 'Кашель' },
        diagnosis,
      ]),
    ).toBe(diagnosis);
  });
});

describe('DEFAULT_ACTIVE_SECTION', () => {
  it('является полем жалоб', () => {
    expect(isComplaintsField(DEFAULT_ACTIVE_SECTION)).toBe(true);
  });
});
