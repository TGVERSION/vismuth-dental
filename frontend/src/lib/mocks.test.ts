import { describe, expect, it } from 'vitest';
import { MOCK_NAMES, parseMocks } from './mocks';

describe('parseMocks', () => {
  it('пустое значение — ни одной заглушки', () => {
    expect(parseMocks('')).toEqual({ enabled: [], unknown: [] });
    expect(parseMocks(' , ')).toEqual({ enabled: [], unknown: [] });
  });

  it('`all` включает все заглушки', () => {
    expect(parseMocks('all')).toEqual({
      enabled: [...MOCK_NAMES],
      unknown: [],
    });
  });

  it('список через запятую, без учёта пробелов и регистра', () => {
    expect(parseMocks(' Speech , doctor-questionnaires')).toEqual({
      enabled: ['speech', 'doctor-questionnaires'],
      unknown: [],
    });
  });

  it('неизвестные имена не включают ничего и возвращаются отдельно', () => {
    expect(parseMocks('speach,questionnaire')).toEqual({
      enabled: ['questionnaire'],
      unknown: ['speach'],
    });
    expect(parseMocks('all,oops')).toEqual({
      enabled: [...MOCK_NAMES],
      unknown: ['oops'],
    });
  });
});
