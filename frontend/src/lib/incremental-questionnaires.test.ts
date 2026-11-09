import { describe, expect, it } from 'vitest';
import { appendUniqueItems } from './incremental-questionnaires';

describe('incremental questionnaires', () => {
  it('keeps existing order, updates repeated rows and appends each new id once', () => {
    const first = [
      { id: 'a', text: 'old' },
      { id: 'b', text: 'keep' },
    ];
    expect(
      appendUniqueItems(first, [
        { id: 'a', text: 'updated' },
        { id: 'c', text: 'new' },
        { id: 'c', text: 'latest' },
      ]),
    ).toEqual([
      { id: 'a', text: 'updated' },
      { id: 'b', text: 'keep' },
      { id: 'c', text: 'latest' },
    ]);
    expect(first[0].text).toBe('old');
  });
});
