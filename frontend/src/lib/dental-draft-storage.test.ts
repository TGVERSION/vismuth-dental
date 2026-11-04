import { describe, expect, it } from 'vitest';
import {
  readDentalDraft,
  saveDentalDraft,
  clearDentalDraft,
  DENTAL_DRAFT_TTL_MS,
} from './dental-draft-storage';
const storage = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};
const draft = {
  selections: { reason: ['other'] },
  texts: { reason: 'проверить пломбу' },
};
describe('dental draft lifetime and isolation', () => {
  it('keeps unsent input after editing a different step, only if its server baseline is unchanged', () => {
    const store = storage();
    saveDentalDraft(
      store,
      'q1',
      'dental_about',
      2,
      draft,
      100,
      'unchanged-about',
    );
    expect(
      readDentalDraft(store, 'q1', 'dental_about', 4, 101, 'unchanged-about'),
    ).toEqual(draft);
    expect(
      readDentalDraft(store, 'q1', 'dental_about', 4, 101, 'changed-on-server'),
    ).toBeNull();
    expect(
      readDentalDraft(store, 'q1', 'dental_health', 4, 101, 'unchanged-about'),
    ).toBeNull();
  });
  it('restores only the same questionnaire, step and revision without storing token', () => {
    const store = storage();
    saveDentalDraft(store, 'q1', 'dental_reason', 2, draft, 100);
    expect(readDentalDraft(store, 'q1', 'dental_reason', 2, 101)).toEqual(
      draft,
    );
    expect(readDentalDraft(store, 'q2', 'dental_reason', 2, 101)).toBeNull();
    expect(readDentalDraft(store, 'q1', 'dental_reason', 3, 101)).toBeNull();
    expect([...store.values.keys()][0]).not.toContain('token');
  });
  it('expires, removes broken state and clears all steps at completion', () => {
    const store = storage();
    saveDentalDraft(store, 'q1', 'dental_reason', 2, draft, 100);
    expect(
      readDentalDraft(
        store,
        'q1',
        'dental_reason',
        2,
        100 + DENTAL_DRAFT_TTL_MS,
      ),
    ).toBeNull();
    saveDentalDraft(store, 'q1', 'dental_reason', 2, draft, 200);
    saveDentalDraft(store, 'q1', 'dental_health', 3, draft, 200);
    clearDentalDraft(store, 'q1');
    expect(store.values.size).toBe(0);
  });
  it('survives denied storage and corrupt data', () => {
    const denied = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveDentalDraft(denied, 'q', 'step', 1, draft)).not.toThrow();
    expect(readDentalDraft(denied, 'q', 'step', 1)).toBeNull();
  });
});
