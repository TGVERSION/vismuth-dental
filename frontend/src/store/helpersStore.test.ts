import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({ mainApi: { userSettings: {} } }));
vi.mock('@/api/base-client', () => ({ ApiError: class ApiError extends Error {} }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('значение по умолчанию проверки для ДМС', () => {
  beforeEach(() => {
    vi.resetModules();
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    });
  });

  it('включена в новом браузере, запись приёма остаётся выключенной', async () => {
    const { useHelpersStore } = await import('./helpersStore');
    expect(useHelpersStore.getState().dmsEnabled).toBe(true);
    expect(useHelpersStore.getState().isHelperActive('dms')).toBe(true);
    expect(useHelpersStore.getState().voiceEnabled).toBe(false);
  });

  it.each([true, false])('сохраняет записанное пользователем состояние %s', async (enabled) => {
    localStorage.setItem('helpers-storage', JSON.stringify({
      state: { dmsEnabled: enabled, voiceEnabled: true }, version: 0,
    }));
    const { useHelpersStore } = await import('./helpersStore');
    expect(useHelpersStore.getState().dmsEnabled).toBe(enabled);
    expect(useHelpersStore.getState().voiceEnabled).toBe(true);
  });
});
