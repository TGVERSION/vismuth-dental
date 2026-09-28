import { describe, expect, it } from 'vitest';
import type { ClinicMemberRead, ClinicRead } from '@/api';
import {
  EMPTY_CLINIC_DRAFT,
  buildClinicCreate,
  buildMemberRolesPatch,
  canAddDoctor,
  canCreateClinic,
  clinicAdminOptions,
  clinicToDraft,
  doctorsLimitOptions,
  filterMembers,
  filterOptions,
  formatMemberName,
  formatPhone,
  getClinicStatus,
  inviteErrorMessage,
  isValidEmail,
  isValidImageUrl,
  isValidPassword,
  memberFlagsToRoles,
  memberRolesToFlags,
  nextClinicSave,
  normalizePhone,
  parseFullName,
  validateClinicField,
  visibleMembers,
  type ClinicDraft,
} from './clinics';

const today = new Date(2026, 8, 27);

const clinic: ClinicRead = {
  id: 'c1',
  name: 'Ангио-лайн',
  phone: '+79000000000',
  email: null,
  logo_url: null,
  brand_color: '#C9CAFF',
  doctors_limit: 5,
  access_until: '2026-10-05',
  access_type: 'trial',
  public_slug: 'angio',
  access_status_code: 'trial',
  access_status_label: 'Пробный период до 05.10.2026',
  doctors_count: 2,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: null,
  deleted_at: null,
};

const member = (overrides: Partial<ClinicMemberRead>): ClinicMemberRead => ({
  id: 'm',
  kind: 'membership',
  status: 'active',
  email: 'doc@clinic.ru',
  first_name: 'Иван',
  last_name: 'Иванов',
  middle_name: 'Иванович',
  photo_url: null,
  is_clinic_admin: false,
  is_doctor: true,
  specializations: [],
  public_slug: null,
  public_url: null,
  expires_at: null,
  user_id: 'u',
  ...overrides,
});

describe('getClinicStatus', () => {
  it('пробный период — серым, дата словами без текущего года', () => {
    expect(getClinicStatus('trial', '2026-10-05', today)).toEqual({
      label: 'Пробный период до 5 октября',
      tone: 'muted',
    });
  });

  it('оплаченная подписка — зелёным, год, если не текущий', () => {
    expect(getClinicStatus('paid', '2027-11-05', today)).toEqual({
      label: 'Подписка до 5 ноября 2027',
      tone: 'success',
    });
  });

  it('завершённая — красным, без даты', () => {
    expect(getClinicStatus('expired', '2026-01-01', today)).toEqual({
      label: 'Подписка завершена',
      tone: 'danger',
    });
  });
});

describe('doctorsLimitOptions', () => {
  it('даёт значения от 1 до 500', () => {
    const options = doctorsLimitOptions(5);
    expect(options).toHaveLength(500);
    expect(options[0]).toBe(1);
    expect(options[499]).toBe(500);
  });

  it('добавляет текущее значение вне диапазона', () => {
    expect(doctorsLimitOptions(0)[0]).toBe(0);
    expect(doctorsLimitOptions(1000).at(-1)).toBe(1000);
    expect(doctorsLimitOptions(1000)).toHaveLength(501);
  });
});

describe('телефон', () => {
  it('нормализует +7, 8 и 10 цифр', () => {
    expect(normalizePhone('+7 (900) 000-00-00')).toBe('+79000000000');
    expect(normalizePhone('89000000000')).toBe('+79000000000');
    expect(normalizePhone('9000000000')).toBe('+79000000000');
  });

  it('не принимает короткий и чужой номер', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+1 202 555 0100')).toBeNull();
  });

  it('форматирует по маске', () => {
    expect(formatPhone('+79001234567')).toBe('+7 900 123-45-67');
    expect(formatPhone('abc')).toBe('abc');
  });
});

describe('валидация', () => {
  it('почта', () => {
    expect(isValidEmail('pochta@mail.ru')).toBe(true);
    expect(isValidEmail('pochta@mail')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('пароль от 8 до 128 символов', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('x'.repeat(129))).toBe(false);
  });

  it('ссылка на картинку: пусто, путь или https', () => {
    expect(isValidImageUrl('')).toBe(true);
    expect(isValidImageUrl('/logos/a.png')).toBe(true);
    expect(isValidImageUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isValidImageUrl('http://cdn.example.com/a.png')).toBe(false);
  });

  it('поля карточки', () => {
    const draft: ClinicDraft = { ...EMPTY_CLINIC_DRAFT };
    expect(validateClinicField('name', draft)).not.toBeNull();
    expect(validateClinicField('phone', { ...draft, phone: '123' })).not.toBe(
      null,
    );
    expect(validateClinicField('phone', draft)).toBeNull();
    expect(
      validateClinicField('brand_color', { ...draft, brand_color: 'red' }),
    ).not.toBeNull();
    expect(
      validateClinicField('brand_color', { ...draft, brand_color: '#c9caff' }),
    ).toBeNull();
  });
});

describe('создание и сохранение клиники', () => {
  const filled: ClinicDraft = {
    ...EMPTY_CLINIC_DRAFT,
    name: ' Ангио-лайн ',
    access_until: '2026-10-05',
  };

  it('создаёт, только когда заполнены название, тип и дата', () => {
    expect(canCreateClinic(EMPTY_CLINIC_DRAFT)).toBe(false);
    expect(canCreateClinic({ ...filled, access_type: '' })).toBe(false);
    expect(canCreateClinic(filled)).toBe(true);
  });

  it('в создание уходят только валидные необязательные поля', () => {
    const data = buildClinicCreate({
      ...filled,
      phone: '8 900 000 00 00',
      brand_color: 'не цвет',
    });
    expect(data).toEqual({
      name: 'Ангио-лайн',
      access_type: 'trial',
      access_until: '2026-10-05',
      doctors_limit: 10,
      phone: '+79000000000',
    });
  });

  it('без клиники ждёт обязательных полей, затем создаёт', () => {
    expect(nextClinicSave(null, { ...filled, name: '' }, 'name').kind).toBe(
      'invalid',
    );
    expect(nextClinicSave(null, { ...filled, name: '' }, 'phone').kind).toBe(
      'wait',
    );
    expect(
      nextClinicSave(null, { ...filled, access_until: '' }, 'name').kind,
    ).toBe('wait');
    expect(nextClinicSave(null, filled, 'access_until').kind).toBe('create');
  });

  it('у созданной клиники патчит одно изменённое поле', () => {
    const draft = { ...clinicToDraft(clinic), name: 'Новое имя' };
    expect(nextClinicSave(clinic, draft, 'name')).toEqual({
      kind: 'patch',
      data: { name: 'Новое имя' },
    });
  });

  it('не шлёт запрос, если значение не изменилось', () => {
    const draft = clinicToDraft(clinic);
    expect(nextClinicSave(clinic, draft, 'phone').kind).toBe('skip');
    expect(nextClinicSave(clinic, draft, 'name').kind).toBe('skip');
    expect(nextClinicSave(clinic, draft, 'logo_url').kind).toBe('skip');
  });

  it('очистка необязательного поля отправляет null', () => {
    const draft = { ...clinicToDraft(clinic), phone: '' };
    expect(nextClinicSave(clinic, draft, 'phone')).toEqual({
      kind: 'patch',
      data: { phone: null },
    });
  });

  it('невалидное значение не отправляется', () => {
    const draft = { ...clinicToDraft(clinic), logo_url: 'javascript:1' };
    expect(nextClinicSave(clinic, draft, 'logo_url').kind).toBe('invalid');
  });
});

describe('роли сотрудника', () => {
  it('переводит флаги в роли и обратно', () => {
    expect(
      memberFlagsToRoles({ is_clinic_admin: true, is_doctor: true }),
    ).toEqual(['admin', 'doctor']);
    expect(memberRolesToFlags(['doctor'])).toEqual({
      is_clinic_admin: false,
      is_doctor: true,
    });
  });

  it('не даёт снять все роли', () => {
    expect(
      buildMemberRolesPatch({ is_clinic_admin: true, is_doctor: false }, [], [])
        .kind,
    ).toBe('no_roles');
  });

  it('не шлёт запрос без изменений', () => {
    expect(
      buildMemberRolesPatch(
        { is_clinic_admin: false, is_doctor: true },
        ['doctor'],
        [],
      ).kind,
    ).toBe('unchanged');
  });

  it('включает «Врача» только вместе со специализациями', () => {
    const admin = { is_clinic_admin: true, is_doctor: false };
    expect(buildMemberRolesPatch(admin, ['admin', 'doctor'], []).kind).toBe(
      'needs_specialization',
    );
    expect(buildMemberRolesPatch(admin, ['admin', 'doctor'], [3])).toEqual({
      kind: 'patch',
      data: { is_clinic_admin: true, is_doctor: true, specialization_ids: [3] },
    });
  });

  it('снятие роли — просто флаги', () => {
    expect(
      buildMemberRolesPatch(
        { is_clinic_admin: true, is_doctor: true },
        ['doctor'],
        [1],
      ),
    ).toEqual({
      kind: 'patch',
      data: { is_clinic_admin: false, is_doctor: true },
    });
  });
});

describe('ФИО', () => {
  it('собирает ФИО, без него — почту', () => {
    expect(formatMemberName(member({}))).toBe('Иванов Иван Иванович');
    expect(
      formatMemberName(
        member({ first_name: null, last_name: null, middle_name: null }),
      ),
    ).toBe('doc@clinic.ru');
  });

  it('разбирает строку на части', () => {
    expect(parseFullName('  Иванов   Иван  Иванович ')).toEqual({
      last_name: 'Иванов',
      first_name: 'Иван',
      middle_name: 'Иванович',
    });
    expect(parseFullName('Иванов')).toEqual({
      last_name: 'Иванов',
      first_name: null,
      middle_name: null,
    });
    expect(parseFullName('')).toEqual({
      last_name: null,
      first_name: null,
      middle_name: null,
    });
  });
});

describe('список сотрудников', () => {
  const members = [
    member({ id: 'inv', kind: 'invitation', status: 'invited', user_id: null }),
    member({ id: 'off', status: 'deactivated' }),
    member({
      id: 'a',
      first_name: 'Анна',
      last_name: 'Петрова',
      middle_name: null,
      email: 'anna@clinic.ru',
      is_clinic_admin: true,
      is_doctor: false,
    }),
  ];

  it('скрывает отключённых, приглашённых ставит в конец', () => {
    expect(visibleMembers(members).map((m) => m.id)).toEqual(['a', 'inv']);
  });

  it('ищет по ФИО и почте', () => {
    expect(filterMembers(members, 'петрова').map((m) => m.id)).toEqual(['a']);
    expect(filterMembers(members, 'ANNA@').map((m) => m.id)).toEqual(['a']);
    expect(filterMembers(members, '  ')).toHaveLength(3);
  });

  it('администраторы — только работающие, админа без врача снять нельзя', () => {
    const { options, selected } = clinicAdminOptions(members);
    expect(options.map((o) => o.value)).toEqual(['a']);
    expect(options[0].disabled).toBe(true);
    expect(selected).toEqual(['a']);
  });
});

describe('лимит врачей', () => {
  it('разрешает врача, пока лимит не достигнут', () => {
    expect(canAddDoctor({ doctors_count: 4, doctors_limit: 5 })).toBe(true);
    expect(canAddDoctor({ doctors_count: 5, doctors_limit: 5 })).toBe(false);
    expect(canAddDoctor({ doctors_count: 6, doctors_limit: 5 })).toBe(false);
  });
});

describe('inviteErrorMessage', () => {
  it('разбирает конфликты', () => {
    expect(
      inviteErrorMessage(409, 'Лимит 5 из 5, обратитесь к администратору'),
    ).toBe('Достигнут лимит врачей клиники');
    expect(
      inviteErrorMessage(
        409,
        'Pending invitation for this email already exists',
      ),
    ).toBe('Приглашение на эту почту уже отправлено');
    expect(inviteErrorMessage(409, 'User with this email already exists')).toBe(
      'Пользователь с такой почтой уже зарегистрирован',
    );
  });

  it('разбирает прочие ошибки', () => {
    expect(
      inviteErrorMessage(
        400,
        'Doctor invitation requires at least one specialization',
      ),
    ).toBe('Для врача выберите специализацию');
    expect(inviteErrorMessage(undefined, undefined)).toBe(
      'Не удалось отправить приглашение',
    );
  });
});

describe('filterOptions', () => {
  const options = [
    { value: 1, label: 'Кардиолог' },
    { value: 2, label: 'Терапевт' },
    { value: 3, label: 'Хирург' },
  ];

  it('без строки поиска возвращает все опции', () => {
    expect(filterOptions(options, '  ', [])).toHaveLength(3);
  });

  it('ищет без учёта регистра и оставляет выбранные', () => {
    expect(filterOptions(options, 'ТЕРА', [3]).map((o) => o.value)).toEqual([
      2, 3,
    ]);
  });

  it('сохраняет дополнительные поля опции', () => {
    const withFlag = [{ value: 'a', label: 'Анна', disabled: true }];
    expect(filterOptions(withFlag, 'ан', [])[0].disabled).toBe(true);
  });
});
