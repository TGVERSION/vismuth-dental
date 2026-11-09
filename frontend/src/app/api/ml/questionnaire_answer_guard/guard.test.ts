import { describe, expect, it } from 'vitest';
import * as route from '../../internal-ml-denied/route';

describe('internal questionnaire classifier', () => {
  it.each([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD',
  ] as const)('не публикуется через ML proxy: %s', async (method) => {
    const response = route[method]();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Not Found' });
  });
});
