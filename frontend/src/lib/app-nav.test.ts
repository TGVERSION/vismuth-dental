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

  it('скрывает протоколы, пока роль не известна', () => {
    expect(getNavItems({ showRegistry: false }).map((i) => i.id)).toEqual([
      'questionnaires',
    ]);
    expect(getNavItems({ showRegistry: true }).map((i) => i.id)).toEqual([
      'registry',
      'questionnaires',
    ]);
  });

  it.each(['doctor', 'admin', 'patient', null])(
    'скрывает протоколы для роли %s',
    (role) => {
      expect(
        getNavItems({ showRegistry: true, role }).map((i) => i.id),
      ).toEqual(['registry', 'questionnaires']);
    },
  );

  it('использует общие названия разделов для супер-админа и добавляет заявки', () => {
    expect(getNavItems({ showRegistry: true, role: 'super_admin' })).toEqual([
      { id: 'registry', label: 'Анкеты для стоматологии', href: '/registry' },
      {
        id: 'completed',
        label: 'Анкеты для врачей',
        href: '/completed-questionnaires',
      },
      { id: 'protocols', label: 'Протоколы', href: '/' },
      { id: 'requests', label: 'Заявки', href: '/join-requests' },
    ]);
  });

  it('показывается админу клиники со стоматологической анкетой', () => {
    expect(
      canUseRegistry({ is_clinic_admin: true, questionnaire_kind: 'dental' }),
    ).toBe(true);
    expect(
      canUseRegistry({ is_clinic_admin: false, questionnaire_kind: 'dental' }),
    ).toBe(false);
    expect(
      canUseRegistry({ is_clinic_admin: true, questionnaire_kind: 'general' }),
    ).toBe(false);
    expect(canUseRegistry(null)).toBe(false);
  });

  it('доступен администратору смешанной клиники', () => {
    expect(
      canUseRegistry({ is_clinic_admin: true, questionnaire_kind: 'mixed' }),
    ).toBe(true);
    expect(
      canUseRegistry({ is_clinic_admin: false, questionnaire_kind: 'mixed' }),
    ).toBe(false);
  });
});

it('superadmin sees supported routes without own clinic membership', () => {
  expect(
    getNavItems({ showRegistry: false, role: 'super_admin' }).map(
      (i) => i.href,
    ),
  ).toEqual(['/registry', '/completed-questionnaires', '/', '/join-requests']);
  expect(
    getNavItems({ showRegistry: false, role: 'doctor' }).map((i) => i.href),
  ).toEqual(['/questionnaires']);
});
