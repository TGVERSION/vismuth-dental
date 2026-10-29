import { describe, it, expect } from 'vitest';
import type { CheckDmsSegment, StructureProtocolsFields } from '@/api';
import type { DraftSection } from './protocol-draft';
import {
  buildDmsPlan,
  classifyDmsError,
  DMS_APPOINTMENTS_MAX_LENGTH,
  DMS_ERROR_MESSAGE,
  DMS_GUIDELINE_FILE_MESSAGE,
  DMS_NOT_DEPLOYED_MESSAGE,
  DMS_SUBSCRIPTION_MESSAGE,
  DmsResponseMismatchError,
  dmsRequestFor,
  dmsStepAt,
  extractMkbCode,
  findTooLongTarget,
  mapDmsResponse,
  noGuidelineText,
  removeUnnecessary,
} from './dms-check';

const field = (id: string, fieldType = 'text') =>
  ({ id, field_type: fieldType }) as StructureProtocolsFields;

const section = (
  id: number,
  sectionKey: string,
  label: string,
  value: string,
  fieldMeta?: StructureProtocolsFields,
): DraftSection => ({ id, sectionKey, label, value, fieldMeta });

const protocol: DraftSection[] = [
  section(0, 'fio', 'ФИО пациента', 'Иванов Иван Иванович'),
  section(1, 'complaints', 'Жалобы', 'Кашель'),
  section(2, 'main_diagnosis', 'Диагноз', 'J06.8 – Другие острые инфекции'),
  section(
    3,
    'rekomendatsii',
    'Рекомендации',
    ' Обильное питьё ',
    field('uuid-r'),
  ),
  section(
    4,
    'naznacheniya',
    'Назначения',
    'Парацетамол 500 мг, Витамин C 1000 мг, Ибупрофен 200 мг',
    field('uuid-p'),
  ),
];

const seg = (text: string, unnecessary = false): CheckDmsSegment => ({
  text,
  unnecessary,
});

describe('buildDmsPlan', () => {
  it('берёт диагноз и разделы помощника без пробелов по краям', () => {
    expect(buildDmsPlan(protocol)).toEqual({
      mkb: 'J06.8 – Другие острые инфекции',
      targets: [
        { sectionId: 3, label: 'Рекомендации', value: 'Обильное питьё' },
        {
          sectionId: 4,
          label: 'Назначения',
          value: 'Парацетамол 500 мг, Витамин C 1000 мг, Ибупрофен 200 мг',
        },
      ],
    });
  });

  it('не отправляет персональные данные и другие поля', () => {
    const plan = buildDmsPlan(protocol)!;
    const body = JSON.stringify(
      plan.targets.map((target) => dmsRequestFor(plan, target)),
    );

    expect(body).not.toContain('Иванов');
    expect(body).not.toContain('Кашель');
  });

  it('один запрос на раздел: диагноз и текст раздела', () => {
    const plan = buildDmsPlan(protocol)!;

    expect(dmsRequestFor(plan, plan.targets[0])).toEqual({
      mkb: 'J06.8 – Другие острые инфекции',
      appointments: 'Обильное питьё',
    });
  });

  it('пропускает пустые разделы', () => {
    const plan = buildDmsPlan(
      protocol.map((s) => (s.id === 3 ? { ...s, value: '  ' } : s)),
    );

    expect(plan?.targets.map((t) => t.sectionId)).toEqual([4]);
  });

  it('возвращает null без диагноза или без разделов с текстом', () => {
    expect(
      buildDmsPlan(protocol.map((s) => (s.id === 2 ? { ...s, value: '' } : s))),
    ).toBeNull();
    expect(
      buildDmsPlan(protocol.filter((s) => s.id !== 3 && s.id !== 4)),
    ).toBeNull();
  });
});

describe('findTooLongTarget', () => {
  it('находит раздел длиннее ограничения backend', () => {
    const long = 'А'.repeat(DMS_APPOINTMENTS_MAX_LENGTH + 1);
    const plan = buildDmsPlan(
      protocol.map((s) => (s.id === 4 ? { ...s, value: long } : s)),
    )!;

    expect(findTooLongTarget(plan)?.sectionId).toBe(4);
    expect(findTooLongTarget(buildDmsPlan(protocol)!)).toBeNull();
  });
});

describe('mapDmsResponse', () => {
  const target = buildDmsPlan(protocol)!.targets[1];
  const segments = [
    seg('Парацетамол 500 мг, '),
    seg('Витамин C 1000 мг', true),
    seg(', Ибупрофен 200 мг'),
  ];

  it('собирает отметки, фрагменты и текст без лишнего', () => {
    const finding = mapDmsResponse(target, {
      appointments: segments,
      fragments: [
        { section: '3.1 Лечение', text: 'Парацетамол при лихорадке' },
        { section: '3.2', text: '  ' },
      ],
      guideline_code: 'kr-1',
      guideline_title: ' Острые респираторные инфекции ',
    });

    expect(finding).toEqual({
      sectionId: 4,
      original: target.value,
      segments,
      fragments: [
        { section: '3.1 Лечение', text: 'Парацетамол при лихорадке' },
      ],
      guidelineTitle: 'Острые респираторные инфекции',
      unnecessaryCount: 1,
      cleaned: 'Парацетамол 500 мг, Ибупрофен 200 мг',
    });
  });

  it('возвращает null, когда лишнего нет', () => {
    expect(
      mapDmsResponse(target, {
        appointments: [seg(target.value)],
        fragments: [],
      }),
    ).toBeNull();
  });

  it('не верит отметкам, если части не складываются в текст раздела', () => {
    expect(() =>
      mapDmsResponse(target, {
        appointments: [seg('Парацетамол', true)],
        fragments: [],
      }),
    ).toThrow(DmsResponseMismatchError);
  });
});

describe('removeUnnecessary', () => {
  it('убирает пункт из середины, начала и конца перечня', () => {
    expect(removeUnnecessary([seg('А, '), seg('Б', true), seg(', В')])).toBe(
      'А, В',
    );
    expect(removeUnnecessary([seg('Б', true), seg(', В')])).toBe('В');
    expect(removeUnnecessary([seg('А; '), seg('Б', true), seg('.')])).toBe(
      'А.',
    );
  });

  it('удаляет строку, от которой остался только номер', () => {
    expect(
      removeUnnecessary([
        seg('1. Парацетамол 500 мг\n2. '),
        seg('Витамин C', true),
        seg('\n3. Ибупрофен'),
      ]),
    ).toBe('1. Парацетамол 500 мг\n3. Ибупрофен');
  });

  it('не трогает строки, где ничего не убрано', () => {
    expect(
      removeUnnecessary([
        seg('Режим  дня\n\nПарацетамол '),
        seg('Витамин C', true),
      ]),
    ).toBe('Режим  дня\n\nПарацетамол');
  });

  it('между словами без разделителей оставляет пробел', () => {
    expect(removeUnnecessary([seg('А '), seg('Б', true), seg(' В')])).toBe(
      'А В',
    );
  });
});

describe('classifyDmsError', () => {
  it('понимает «клинрек не найден» по коду при любом статусе', () => {
    expect(
      classifyDmsError({ status: 422, code: 'guideline_not_found' }),
    ).toEqual({ kind: 'nofound', reason: 'guideline_not_found' });
    expect(
      classifyDmsError({ status: 404, code: 'guideline_not_found' }),
    ).toEqual({ kind: 'nofound', reason: 'guideline_not_found' });
    expect(classifyDmsError({ status: 422, code: 'mkb_required' })).toEqual({
      kind: 'nofound',
      reason: 'mkb_required',
    });
  });

  it('подписка, файл клинрека и отсутствующий эндпоинт — без повтора', () => {
    expect(
      classifyDmsError({ status: 503, code: 'subscription_expired' }),
    ).toEqual({ kind: 'unavailable', message: DMS_SUBSCRIPTION_MESSAGE });
    expect(classifyDmsError({ status: 422, code: 'pdf_invalid' })).toEqual({
      kind: 'unavailable',
      message: DMS_GUIDELINE_FILE_MESSAGE,
    });
    expect(
      classifyDmsError({ status: 422, code: 's3_object_not_found' }),
    ).toEqual({ kind: 'unavailable', message: DMS_GUIDELINE_FILE_MESSAGE });
    expect(classifyDmsError({ status: 404 })).toEqual({
      kind: 'unavailable',
      message: DMS_NOT_DEPLOYED_MESSAGE,
    });
  });

  it('сбой сервиса, таймаут и сеть можно повторить', () => {
    [502, 503, 504].forEach((status) =>
      expect(classifyDmsError({ status })).toEqual({
        kind: 'error',
        message: DMS_ERROR_MESSAGE,
      }),
    );
    expect(classifyDmsError(null)).toEqual({
      kind: 'error',
      message: DMS_ERROR_MESSAGE,
    });
  });
});

describe('noGuidelineText', () => {
  it('называет код диагноза', () => {
    expect(
      noGuidelineText('guideline_not_found', 'J06.8 – Другие острые инфекции')
        .title,
    ).toBe('Для диагноза J06.8 нет клинических рекомендаций.');
  });

  it('обходится без кода, если его нет в строке', () => {
    expect(noGuidelineText('guideline_not_found', 'ОРВИ').title).toBe(
      'Для этого диагноза нет клинических рекомендаций.',
    );
  });

  it('объясняет отсутствие кода МКБ', () => {
    expect(noGuidelineText('mkb_required', 'ОРВИ').title).toBe(
      'В диагнозе нет кода МКБ-10.',
    );
  });
});

describe('extractMkbCode', () => {
  it('берёт ведущий код, как backend', () => {
    expect(extractMkbCode('i10 – Гипертензия')).toBe('I10');
    expect(extractMkbCode(' J06.8 Другие')).toBe('J06.8');
    expect(extractMkbCode('Гипертензия I10')).toBeNull();
  });
});

describe('dmsStepAt', () => {
  it('меняет шаг по прошедшему времени и остаётся на последнем', () => {
    expect(dmsStepAt(0)).toBe(0);
    expect(dmsStepAt(7_999)).toBe(0);
    expect(dmsStepAt(8_000)).toBe(1);
    expect(dmsStepAt(20_000)).toBe(2);
    expect(dmsStepAt(120_000)).toBe(2);
  });
});
