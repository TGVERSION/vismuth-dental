import { describe, expect, it } from 'vitest';
import { partitionDentalHealth } from './dental-health';

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
