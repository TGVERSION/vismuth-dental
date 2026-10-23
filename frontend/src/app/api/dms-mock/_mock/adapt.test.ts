import { describe, it, expect } from 'vitest';
import { adaptLine, adaptText, buildMockReply } from './adapt';

describe('adaptLine', () => {
  // Пример из дизайна PL-314.
  it('дополняет препарат кратностью и длительностью', () => {
    expect(adaptLine('Лизиноприл 10 мг утром')).toBe(
      'Лизиноприл 10 мг внутрь 1 раз в сутки утром, постоянно.',
    );
  });

  it('не трогает кратность и длительность, если они уже есть', () => {
    expect(adaptLine('Амоксициллин 1000 мг 3 раза в день, 7 дней')).toBe(
      'Амоксициллин 1000 мг 3 раза в день, 7 дней',
    );
  });

  it('добавляет цель к обследованию', () => {
    expect(adaptLine('Общий анализ крови развёрнутый')).toBe(
      'Общий анализ крови развёрнутый для оценки течения заболевания (КР, разд. 2.3)',
    );
  });

  it('помечает назначение без обоснования', () => {
    expect(adaptLine('Колекальциферол 2000 МЕ ежедневно')).toBe(
      'Колекальциферол 2000 МЕ ежедневно — обоснование в клинических рекомендациях не найдено',
    );
  });

  // Как в дизайне: раздел «Рекомендации» остаётся без изменений.
  it('не меняет общие рекомендации', () => {
    const line =
      'Обильное теплое питье, постельный режим. При повышении температуры выше 38,0˚C — жаропонижающие (парацетамол 500 мг, не более 4 раз в сутки).';

    expect(adaptLine(line)).toBe(line);
  });

  it('не добавляет квадратных скобок', () => {
    const adapted = adaptText(
      'Лизиноприл 10 мг утром\nОбщий анализ крови\nВитамин D 1000 МЕ',
    );

    expect(adapted).not.toMatch(/[[\]]/);
  });
});

describe('buildMockReply', () => {
  const request = (diagnosis: string) => ({
    main_diagnosis: diagnosis,
    sections: [
      { key: '3', label: 'Рекомендации', value: 'Обильное питьё' },
      { key: '4', label: 'Назначения', value: 'Лизиноприл 10 мг утром' },
    ],
  });

  it('возвращает только изменённые разделы и счётчики', () => {
    const reply = buildMockReply(request('J06.8 – ОРВИ'));

    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({
      sections: [
        {
          key: '4',
          adapted_text:
            'Лизиноприл 10 мг внутрь 1 раз в сутки утром, постоянно.',
        },
      ],
      items_total: 2,
      items_justified: 2,
    });
  });

  it('отказывает без кода МКБ', () => {
    expect(buildMockReply(request('ОРВИ'))).toMatchObject({
      status: 422,
      body: { detail: { code: 'mkb_required' } },
    });
  });

  it('отказывает «клинрек не найден» для кодов R и Z', () => {
    expect(buildMockReply(request('R05 – Кашель'))).toMatchObject({
      status: 422,
      body: { detail: { code: 'guideline_not_found' } },
    });
    expect(buildMockReply(request('Z00.0 – Осмотр'))).toMatchObject({
      status: 422,
      body: { detail: { code: 'guideline_not_found' } },
    });
  });

  it('имитирует сбой для кода Y', () => {
    expect(buildMockReply(request('Y40 – Осложнение')).status).toBe(502);
  });
});
