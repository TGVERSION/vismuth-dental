import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DentalCardBody } from '@/components/registry/DentalCardBody';
import { partitionDentalHealth } from './dental-health';

vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

describe('partitionDentalHealth', () => {
  it('keeps unknown health conditions out of explicit negatives', () => {
    const rows = [
      { key: 'allergy', label: 'Аллергия', has: null, detail: '' },
      { key: 'asthma', label: 'Астма', has: true, detail: 'Ингалятор' },
      { key: 'diabetes', label: 'Диабет', has: false, detail: '' },
    ];
    const result = partitionDentalHealth(rows);
    expect(result.uncertain.map((r) => r.key)).toEqual(['allergy']);
    expect(result.positive.map((r) => r.key)).toEqual(['asthma']);
    expect(result.negative.map((r) => r.key)).toEqual(['diabetes']);
  });
});

it('shows reported health details and questions without absent conditions or empty summaries', () => {
  const html = renderToStaticMarkup(
    createElement(DentalCardBody, {
      structured: {
        health: [
          { key: 'allergy', label: 'Аллергия', has: true, detail: 'Пыльца' },
          { key: 'diabetes', label: 'Диабет', has: false, detail: '' },
          { key: 'asthma', label: 'Астма', has: null, detail: 'Не знаю' },
          {
            key: 'hepatitis',
            label: 'Гепатит',
            has: null,
            detail: 'Не отвечено',
          },
        ],
        medications: 'Постоянно не принимает.',
        allergy_anamnesis: 'Аллергии нет.',
      },
      gaps: [{ section: 'complaints', question: 'Когда начались симптомы?' }],
    }),
  );
  for (const text of [
    'Пыльца',
    'астма',
    'Что доспросить',
    'Когда начались симптомы?',
  ])
    expect(html).toContain(text);
  for (const text of [
    'Диабет',
    'гепатит',
    'Постоянно не принимает.',
    'Аллергии нет.',
    'Самое важное',
  ])
    expect(html).not.toContain(text);
});
