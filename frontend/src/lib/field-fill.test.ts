import { describe, expect, it } from 'vitest';
import { FIELD_EMPTY_BG, FIELD_FILLED_BG, fieldFillClass } from './field-fill';

describe('fieldFillClass', () => {
  it('пустые значения — светлый фон', () => {
    expect(fieldFillClass('')).toBe(FIELD_EMPTY_BG);
    expect(fieldFillClass('   ')).toBe(FIELD_EMPTY_BG);
    expect(fieldFillClass([])).toBe(FIELD_EMPTY_BG);
    expect(fieldFillClass(null)).toBe(FIELD_EMPTY_BG);
    expect(fieldFillClass(undefined)).toBe(FIELD_EMPTY_BG);
  });

  it('заполненные значения — тёмный фон', () => {
    expect(fieldFillClass('Ангио-лайн')).toBe(FIELD_FILLED_BG);
    expect(fieldFillClass(['doctor'])).toBe(FIELD_FILLED_BG);
    expect(fieldFillClass(0)).toBe(FIELD_FILLED_BG);
    expect(fieldFillClass('trial')).toBe(FIELD_FILLED_BG);
  });
});
