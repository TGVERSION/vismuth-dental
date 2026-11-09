import { beforeEach, describe, expect, it, vi } from 'vitest';

const patch = vi.hoisted(() => vi.fn());
vi.mock('@/api', () => ({
  mainApi: { userSettings: { patchUserSettings: patch } },
}));
vi.mock('@/api/base-client', () => ({
  ApiError: class ApiError extends Error {},
}));
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

async function loadedStore() {
  const { useHelpersStore } = await import('./helpersStore');
  useHelpersStore.setState({
    userSettings: {
      id: 'settings',
      user_id: 'user',
      mkb_code: false,
      autocomplete: 'off',
      fullness_complaints: true,
      created_at: '',
      updated_at: null,
    },
    mkbEnabled: false,
    fullnessEnabled: true,
    autocompleteProvider: 'off',
  });
  return useHelpersStore;
}

describe('immediate helper settings', () => {
  beforeEach(() => {
    vi.resetModules();
    patch.mockReset().mockResolvedValue({});
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
  });

  it('repeating an explicit on selection never toggles the helper off', async () => {
    const store = await loadedStore();
    await store
      .getState()
      .updateHelperSetting('user', 'mkb', { enabled: true });
    await store
      .getState()
      .updateHelperSetting('user', 'mkb', { enabled: true });
    expect(patch.mock.calls).toEqual([
      ['user', { mkb_code: true }],
      ['user', { mkb_code: true }],
    ]);
    expect(store.getState().mkbEnabled).toBe(true);
  });

  it('a provider choice enables autocomplete immediately; off is explicit', async () => {
    const store = await loadedStore();
    await store
      .getState()
      .updateHelperSetting('user', 'autocomplete', {
        enabled: true,
        autocompleteProvider: 'ml_autocomplete',
      });
    expect(patch).toHaveBeenLastCalledWith('user', {
      autocomplete: 'ml_autocomplete',
    });
    expect(store.getState().isHelperActive('autocomplete')).toBe(true);
    await store
      .getState()
      .updateHelperSetting('user', 'autocomplete', { enabled: false });
    expect(patch).toHaveBeenLastCalledWith('user', { autocomplete: 'off' });
    expect(store.getState().isHelperActive('autocomplete')).toBe(false);
  });

  it('a failed save restores the visible value and retry keeps the same target', async () => {
    const store = await loadedStore();
    patch.mockRejectedValueOnce(new Error('network'));
    const result = await store
      .getState()
      .updateHelperSetting('user', 'mkb', { enabled: true });
    expect(result.success).toBe(false);
    expect(store.getState().mkbEnabled).toBe(false);
    expect(store.getState().userSettings?.mkb_code).toBe(false);
    await store
      .getState()
      .updateHelperSetting('user', 'mkb', { enabled: true });
    expect(store.getState().mkbEnabled).toBe(true);
  });

  it('browser-local helpers persist without an empty backend patch', async () => {
    const store = await loadedStore();
    await store
      .getState()
      .updateHelperSetting('user', 'voice', { enabled: true });
    await store
      .getState()
      .updateHelperSetting('user', 'dms', { enabled: false });
    expect(patch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('helpers-storage')!).state).toEqual({
      voiceEnabled: true,
      dmsEnabled: false,
    });
  });

  it('does not let a second save overtake a pending request', async () => {
    const store = await loadedStore();
    let finish!: () => void;
    patch.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const saving = store
      .getState()
      .updateHelperSetting('user', 'mkb', { enabled: true });
    const blocked = await store
      .getState()
      .updateHelperSetting('user', 'fullness', { enabled: false });
    expect(blocked.success).toBe(false);
    expect(patch).toHaveBeenCalledTimes(1);
    finish();
    await saving;
    expect(store.getState().mkbEnabled).toBe(true);
    expect(store.getState().fullnessEnabled).toBe(true);
  });
});
