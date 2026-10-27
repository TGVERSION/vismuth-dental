import { describe, expect, it } from 'vitest';
import { canUseRegistry, getActiveNavItem, getNavItems } from './app-nav';

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

describe('раздел «Анкеты пациентов»', () => {
  it('открыт по своему пути и вложенным', () => {
    expect(getActiveNavItem('/registry')).toBe('registry');
    expect(getActiveNavItem('/registry/abc')).toBe('registry');
    expect(getActiveNavItem('/registryX')).toBeNull();
  });

  it('виден только регистратуре стоматологической клиники', () => {
    expect(getNavItems({ showRegistry: false }).map((i) => i.id)).toEqual([
      'questionnaires',
      'protocols',
    ]);
    expect(getNavItems({ showRegistry: true }).map((i) => i.id)).toEqual([
      'registry',
      'questionnaires',
      'protocols',
    ]);
  });

  it('показывается админу клиники со стоматологической анкетой', () => {
    expect(canUseRegistry({ is_clinic_admin: true, questionnaire_kind: 'dental' })).toBe(true);
    expect(canUseRegistry({ is_clinic_admin: false, questionnaire_kind: 'dental' })).toBe(false);
    expect(canUseRegistry({ is_clinic_admin: true, questionnaire_kind: 'general' })).toBe(false);
    expect(canUseRegistry(null)).toBe(false);
  });
});
