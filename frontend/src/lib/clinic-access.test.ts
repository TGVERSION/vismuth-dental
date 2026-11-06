import { describe, it, expect } from 'vitest';
import { canUseRegistry, getActiveNavItem } from './app-nav';
import { isPublicPath } from './public-routes';
import { completedQuery, joinStatusLabel, operatorOnly } from './clinic-access';
describe('clinic staff access', () => {
  it('operator can open dental registry without admin rights', () =>
    expect(
      canUseRegistry({
        is_clinic_admin: false,
        is_operator: true,
        questionnaire_kind: 'dental',
      }),
    ).toBe(true));
  it('does not open general registry', () =>
    expect(
      canUseRegistry({
        is_clinic_admin: false,
        is_operator: true,
        questionnaire_kind: 'general',
      }),
    ).toBe(false));
  it('join route is public only by full segment', () => {
    expect(isPublicPath('/clinic-join/token')).toBe(true);
    expect(isPublicPath('/clinic-join-secret')).toBe(false);
  });
  it('operator-only accounts cannot use doctor tools', () => {
    expect(
      operatorOnly({
        is_operator: true,
        is_doctor: false,
        is_clinic_admin: false,
      }),
    ).toBe(true);
    expect(
      operatorOnly({
        is_operator: true,
        is_doctor: true,
        is_clinic_admin: false,
      }),
    ).toBe(false);
  });
  it('completed list starts with all dates', () =>
    expect(
      completedQuery(
        { clinic_id: '', kind: '', name: '  ', date_from: '', date_to: '' },
        1,
      ),
    ).toEqual({ page: 1, page_size: 25 }));
  it('keeps clinic and range on every page', () =>
    expect(
      completedQuery(
        {
          clinic_id: 'a',
          kind: 'dental',
          name: ' Иван ',
          date_from: '2026-11-01',
          date_to: '',
        },
        2,
      ),
    ).toEqual({
      clinic_id: 'a',
      kind: 'dental',
      name: 'Иван',
      date_from: '2026-11-01',
      page: 2,
      page_size: 25,
    }));
  it('pending and rejected have explicit status', () => {
    expect(joinStatusLabel('pending')).toContain('Ожидает');
    expect(joinStatusLabel('rejected')).toContain('Отклонена');
  });
});

it('completed and requests highlight only their own path segments', () => {
  expect(getActiveNavItem('/completed-questionnaires')).toBe('completed');
  expect(getActiveNavItem('/join-requests')).toBe('requests');
  expect(getActiveNavItem('/join-requests-extra')).toBeNull();
});
