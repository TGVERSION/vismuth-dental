import { describe, it, expect } from 'vitest';
import type { StructureProtocolsFields } from '@/api';
import type { DraftSection } from './protocol-draft';
import {
  buildDmsRequest,
  classifyDmsError,
  DMS_ERROR_MESSAGE,
  DMS_NOT_DEPLOYED_MESSAGE,
  DMS_SUBSCRIPTION_MESSAGE,
  dmsStepAt,
  extractMkbCode,
  mapDmsResponse,
  noGuidelineText,
} from './dms-justification';

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
    'Обильное питьё',
    field('uuid-r'),
  ),
  section(
    4,
    'naznacheniya',
    'Назначения',
    'Лизиноприл 10 мг утром',
    field('uuid-p'),
  ),
];

describe('buildDmsRequest', () => {
  it('отправляет только диагноз и разделы помощника', () => {
    expect(buildDmsRequest(protocol)).toEqual({
      main_diagnosis: 'J06.8 – Другие острые инфекции',
      sections: [
        {
          key: '3',
          field_id: 'uuid-r',
          label: 'Рекомендации',
          value: 'Обильное питьё',
        },
        {
          key: '4',
          field_id: 'uuid-p',
          label: 'Назначения',
          value: 'Лизиноприл 10 мг утром',
        },
      ],
    });
  });

  it('не отправляет персональные данные и другие поля', () => {
    const body = JSON.stringify(buildDmsRequest(protocol));

    expect(body).not.toContain('Иванов');
    expect(body).not.toContain('Кашель');
  });

  it('пропускает пустые разделы', () => {
    const request = buildDmsRequest(
      protocol.map((s) => (s.id === 3 ? { ...s, value: '  ' } : s)),
    );

    expect(request?.sections.map((s) => s.key)).toEqual(['4']);
  });

  it('возвращает null без диагноза или без разделов с текстом', () => {
    expect(
      buildDmsRequest(
        protocol.map((s) => (s.id === 2 ? { ...s, value: '' } : s)),
      ),
    ).toBeNull();
    expect(
      buildDmsRequest(protocol.filter((s) => s.id !== 3 && s.id !== 4)),
    ).toBeNull();
  });

  // Имя поля в структуре не уникально — ключ берётся из id раздела формы.
  it('различает разделы с одинаковым именем поля', () => {
    const request = buildDmsRequest([
      section(2, 'main_diagnosis', 'Диагноз', 'I10 – Гипертензия'),
      section(7, 'naznacheniya', 'Назначения', 'А'),
      section(8, 'naznacheniya', 'Назначения', 'Б'),
    ]);

    expect(request?.sections.map((s) => s.key)).toEqual(['7', '8']);
  });
});

describe('mapDmsResponse', () => {
  const request = buildDmsRequest(protocol)!;
  const response = (sections: { key: string; adapted_text: string }[]) => ({
    guideline_code: 'kr-1',
    guideline_title: 'ОРВИ',
    sections,
    items_total: 2,
    items_justified: 1,
    error: null,
  });

  it('возвращает предложения только для изменённых разделов', () => {
    const proposals = mapDmsResponse(
      request,
      response([
        { key: '3', adapted_text: 'Обильное питьё' },
        { key: '4', adapted_text: 'Лизиноприл 10 мг внутрь утром, постоянно.' },
      ]),
    );

    expect(proposals).toEqual([
      {
        sectionId: 4,
        original: 'Лизиноприл 10 мг утром',
        proposal: 'Лизиноприл 10 мг внутрь утром, постоянно.',
      },
    ]);
  });

  it('отбрасывает пустой ответ и разделы, о которых не спрашивали', () => {
    const proposals = mapDmsResponse(
      request,
      response([
        { key: '4', adapted_text: '   ' },
        { key: '1', adapted_text: 'Кашель сухой' },
      ]),
    );

    expect(proposals).toEqual([]);
  });

  it('не падает на ответе без списка разделов', () => {
    expect(
      mapDmsResponse(request, {
        ...response([]),
        sections: undefined as unknown as [],
      }),
    ).toEqual([]);
  });
});

describe('classifyDmsError', () => {
  it('понимает «клинрек не найден» по коду при любом статусе', () => {
    expect(
      classifyDmsError({ status: 422, code: 'guideline_not_found' }),
    ).toEqual({
      kind: 'nofound',
      reason: 'guideline_not_found',
    });
    expect(
      classifyDmsError({ status: 404, code: 'guideline_not_found' }),
    ).toEqual({
      kind: 'nofound',
      reason: 'guideline_not_found',
    });
    expect(classifyDmsError({ status: 422, code: 'mkb_required' })).toEqual({
      kind: 'nofound',
      reason: 'mkb_required',
    });
  });

  it('истёкшая подписка и отсутствующий эндпоинт — без повтора', () => {
    expect(
      classifyDmsError({ status: 503, code: 'subscription_expired' }),
    ).toEqual({
      kind: 'unavailable',
      message: DMS_SUBSCRIPTION_MESSAGE,
    });
    expect(classifyDmsError({ status: 404 })).toEqual({
      kind: 'unavailable',
      message: DMS_NOT_DEPLOYED_MESSAGE,
    });
  });

  it('сбой сервиса и сети можно повторить', () => {
    expect(classifyDmsError({ status: 502 })).toEqual({
      kind: 'error',
      message: DMS_ERROR_MESSAGE,
    });
    expect(classifyDmsError({ status: 503 })).toEqual({
      kind: 'error',
      message: DMS_ERROR_MESSAGE,
    });
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
