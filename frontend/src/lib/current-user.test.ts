import { describe, expect, it } from 'vitest';
import type { ServiceUserData } from '@/api';
import { mergeCurrentUser } from './current-user';

const stored: ServiceUserData = {
  id: 'user-1',
  login: 'admin@clinic.ru',
  first_name: 'Анна',
  last_name: null,
  // Сохранено до миграции ролей: в localStorage лежит старый код.
  role: 'administrator' as ServiceUserData['role'],
  role_name_ru: undefined as unknown as string,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  deleted_at: null,
};

const me: ServiceUserData = {
  login: 'admin@clinic.ru',
  first_name: 'Анна',
  last_name: 'Иванова',
  role: 'admin',
  role_name_ru: 'Администратор',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-09-27T00:00:00Z',
  deleted_at: null,
};

describe('mergeCurrentUser', () => {
  it('обновляет роль и подпись роли с сервера', () => {
    const merged = mergeCurrentUser(stored, me);
    expect(merged.role).toBe('admin');
    expect(merged.role_name_ru).toBe('Администратор');
    expect(merged.last_name).toBe('Иванова');
  });

  it('сохраняет id из стора: в ответе сервера его нет', () => {
    expect(mergeCurrentUser(stored, me).id).toBe('user-1');
  });

  it('не даёт ответу сервера перетереть id', () => {
    expect(mergeCurrentUser(stored, { ...me, id: 'other' }).id).toBe('user-1');
  });
});
