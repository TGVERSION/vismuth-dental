import { describe, expect, it } from 'vitest';
import { getActiveNavItem } from './app-nav';

describe('getActiveNavItem', () => {
  it('экран протокола — раздел «Протоколы»', () => {
    expect(getActiveNavItem('/')).toBe('protocols');
  });

  it('страница анкет и вложенные пути — раздел «Анкеты»', () => {
    expect(getActiveNavItem('/questionnaires')).toBe('questionnaires');
    expect(getActiveNavItem('/questionnaires/')).toBe('questionnaires');
    expect(getActiveNavItem('/questionnaires/abc')).toBe('questionnaires');
  });

  it('путь, совпадающий только по буквам, разделом не считается', () => {
    expect(getActiveNavItem('/questionnairesX')).toBeNull();
  });

  it('прочие страницы вне разделов', () => {
    expect(getActiveNavItem('/q/demo')).toBeNull();
    expect(getActiveNavItem('/login')).toBeNull();
  });
});
