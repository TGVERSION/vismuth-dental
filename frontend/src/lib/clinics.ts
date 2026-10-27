// Правила раздела «Клиники»: всё, что можно проверить без браузера.

import type {
  ClinicAccessStatus,
  ClinicAccessType,
  ClinicCreate,
  ClinicMemberPatch,
  ClinicMemberRead,
  ClinicPatch,
  ClinicQuestionnaireKind,
  ClinicRead,
} from '@/api';
import { formatDayMonth } from './calendar';
import { sanitizeBrandColor, sanitizeImageUrl } from './branding';

// --- Статус доступа ---------------------------------------------------------

export type ClinicStatusTone = 'muted' | 'success' | 'danger';

export interface ClinicStatus {
  label: string;
  tone: ClinicStatusTone;
}

/**
 * Статус клиники в формате макета: «Пробный период до 5 октября».
 * Код статуса вычисляет backend, здесь — только подпись и цвет.
 */
export const getClinicStatus = (
  code: ClinicAccessStatus,
  accessUntil: string,
  today: Date = new Date(),
): ClinicStatus => {
  if (code === 'expired') {
    return { label: 'Подписка завершена', tone: 'danger' };
  }

  const until = formatDayMonth(accessUntil, today);
  if (code === 'trial') {
    return { label: `Пробный период до ${until}`, tone: 'muted' };
  }

  return { label: `Подписка до ${until}`, tone: 'success' };
};

// --- Поля карточки ----------------------------------------------------------

export const DOCTORS_LIMIT_MIN = 1;
export const DOCTORS_LIMIT_MAX = 500;
/** Лимит по умолчанию — как в backend (`ClinicCreate.doctors_limit`). */
export const DOCTORS_LIMIT_DEFAULT = 10;

/**
 * Значения выпадающего списка лимита. Текущее значение вне диапазона
 * (backend принимает любое число от 0) добавляется, чтобы список его показал.
 */
export const doctorsLimitOptions = (current: number | null): number[] => {
  const options = Array.from(
    { length: DOCTORS_LIMIT_MAX - DOCTORS_LIMIT_MIN + 1 },
    (_, index) => DOCTORS_LIMIT_MIN + index,
  );

  if (
    current !== null &&
    Number.isInteger(current) &&
    current >= 0 &&
    !options.includes(current)
  ) {
    options.push(current);
    options.sort((a, b) => a - b);
  }

  return options;
};

export const ACCESS_TYPE_OPTIONS: { value: ClinicAccessType; label: string }[] =
  [
    { value: 'trial', label: 'Пробный' },
    { value: 'paid', label: 'Платный' },
  ];

export const QUESTIONNAIRE_KIND_OPTIONS: {
  value: ClinicQuestionnaireKind;
  label: string;
}[] = [
  { value: 'general', label: 'Общая' },
  { value: 'dental', label: 'Стоматологическая' },
];

/** Значения полей карточки в том виде, в каком их редактирует пользователь. */
export interface ClinicDraft {
  name: string;
  access_type: ClinicAccessType | '';
  /** Общая анкета по ссылке и QR врача или стоматологическая по ссылкам регистратуры. */
  questionnaire_kind: ClinicQuestionnaireKind;
  /** `YYYY-MM-DD` или пусто. */
  access_until: string;
  doctors_limit: number;
  phone: string;
  logo_url: string;
  brand_color: string;
}

export type ClinicField = keyof ClinicDraft;

export const EMPTY_CLINIC_DRAFT: ClinicDraft = {
  name: '',
  access_type: 'trial',
  questionnaire_kind: 'general',
  access_until: '',
  doctors_limit: DOCTORS_LIMIT_DEFAULT,
  phone: '',
  logo_url: '',
  brand_color: '',
};

export const clinicToDraft = (clinic: ClinicRead): ClinicDraft => ({
  name: clinic.name,
  access_type: clinic.access_type,
  questionnaire_kind: clinic.questionnaire_kind,
  access_until: clinic.access_until,
  doctors_limit: clinic.doctors_limit,
  phone: clinic.phone ? formatPhone(clinic.phone) : '',
  logo_url: clinic.logo_url ?? '',
  brand_color: clinic.brand_color ?? '',
});

// --- Проверка полей ---------------------------------------------------------

/** Телефон в виде `+7XXXXXXXXXX` или null, если это не российский номер. */
export const normalizePhone = (value: string): string | null => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    digits = digits.slice(1);
  }

  return digits.length === 10 ? `+7${digits}` : null;
};

/** `+7 900 000-00-00`. Непохожий на номер текст возвращается как есть. */
export const formatPhone = (value: string): string => {
  const normalized = normalizePhone(value);
  if (!normalized) return value;

  const d = normalized.slice(2);
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const isValidPassword = (value: string): boolean =>
  value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;

/** Ссылка на картинку: пусто или адрес, который пропустит анкета. */
export const isValidImageUrl = (value: string): boolean =>
  value.trim() === '' || sanitizeImageUrl(value) !== null;

/** Текст ошибки поля или null, если значение можно сохранять. */
export const validateClinicField = (
  field: ClinicField,
  draft: ClinicDraft,
): string | null => {
  switch (field) {
    case 'name':
      return draft.name.trim() ? null : 'Введите название клиники';
    case 'access_type':
      return draft.access_type ? null : 'Выберите тип доступа';
    case 'questionnaire_kind':
      return null;
    case 'access_until':
      return draft.access_until ? null : 'Выберите дату';
    case 'doctors_limit':
      return Number.isInteger(draft.doctors_limit) && draft.doctors_limit >= 0
        ? null
        : 'Выберите лимит';
    case 'phone':
      return draft.phone.trim() === '' || normalizePhone(draft.phone)
        ? null
        : 'Номер в формате +7 900 000-00-00';
    case 'logo_url':
      return isValidImageUrl(draft.logo_url)
        ? null
        : 'Ссылка вида https://… или /путь/к/файлу.png';
    case 'brand_color':
      return draft.brand_color.trim() === '' ||
        sanitizeBrandColor(draft.brand_color)
        ? null
        : 'Цвет в формате #C9CAFF';
  }
};

/** Значение поля для API: нормализованное, пустое — null. */
const toApiValue = (
  field: ClinicField,
  draft: ClinicDraft,
): ClinicPatch[keyof ClinicPatch] => {
  switch (field) {
    case 'name':
      return draft.name.trim();
    case 'access_type':
      return draft.access_type || undefined;
    case 'questionnaire_kind':
      return draft.questionnaire_kind;
    case 'access_until':
      return draft.access_until;
    case 'doctors_limit':
      return draft.doctors_limit;
    case 'phone':
      return draft.phone.trim() ? normalizePhone(draft.phone) : null;
    case 'logo_url':
      return draft.logo_url.trim() || null;
    case 'brand_color':
      return draft.brand_color.trim()
        ? sanitizeBrandColor(draft.brand_color)
        : null;
  }
};

const OPTIONAL_FIELDS: ClinicField[] = [
  'doctors_limit',
  'phone',
  'logo_url',
  'brand_color',
];

export const canCreateClinic = (draft: ClinicDraft): boolean =>
  draft.name.trim() !== '' &&
  draft.access_type !== '' &&
  draft.access_until !== '';

/**
 * Тело создания: обязательные поля и только валидные необязательные.
 * Невалидные остаются в форме с ошибкой и уйдут отдельным сохранением.
 */
export const buildClinicCreate = (draft: ClinicDraft): ClinicCreate => {
  const data: ClinicCreate = {
    name: draft.name.trim(),
    access_type: draft.access_type as ClinicAccessType,
    access_until: draft.access_until,
    questionnaire_kind: draft.questionnaire_kind,
  };

  for (const field of OPTIONAL_FIELDS) {
    if (validateClinicField(field, draft) !== null) continue;
    const value = toApiValue(field, draft);
    if (value !== null && value !== undefined) {
      Object.assign(data, { [field]: value });
    }
  }

  return data;
};

export type ClinicSave =
  | { kind: 'create'; data: ClinicCreate }
  | { kind: 'patch'; data: ClinicPatch }
  | { kind: 'wait' }
  | { kind: 'skip' }
  | { kind: 'invalid'; error: string };

/**
 * Что сделать при сохранении поля.
 *
 * Клиники ещё нет — создаём, как только заполнены обязательные поля, иначе
 * ждём. Клиника есть — патчим одно поле, если значение отличается от
 * сохранённого на сервере.
 */
export const nextClinicSave = (
  saved: ClinicRead | null,
  draft: ClinicDraft,
  field: ClinicField,
): ClinicSave => {
  const error = validateClinicField(field, draft);
  if (error) return { kind: 'invalid', error };

  if (!saved) {
    return canCreateClinic(draft)
      ? { kind: 'create', data: buildClinicCreate(draft) }
      : { kind: 'wait' };
  }

  const value = toApiValue(field, draft);
  if (value === undefined || value === (saved[field] ?? null)) {
    return { kind: 'skip' };
  }

  return { kind: 'patch', data: { [field]: value } };
};

/**
 * Опции выпадающего списка по строке поиска. Выбранные значения остаются
 * всегда — иначе поле показало бы плейсхолдер вместо текущего значения.
 */
export const filterOptions = <O extends { value: unknown; label: string }>(
  options: O[],
  query: string,
  selected: O['value'][],
): O[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;

  return options.filter(
    (option) =>
      selected.includes(option.value) ||
      option.label.toLowerCase().includes(needle),
  );
};

// --- Сотрудники -------------------------------------------------------------

export type MemberRole = 'admin' | 'doctor';

export const MEMBER_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Админ' },
  { value: 'doctor', label: 'Врач' },
];

interface MemberFlags {
  is_clinic_admin: boolean;
  is_doctor: boolean;
}

export const memberFlagsToRoles = (member: MemberFlags): MemberRole[] => {
  const roles: MemberRole[] = [];
  if (member.is_clinic_admin) roles.push('admin');
  if (member.is_doctor) roles.push('doctor');
  return roles;
};

export const memberRolesToFlags = (roles: MemberRole[]): MemberFlags => ({
  is_clinic_admin: roles.includes('admin'),
  is_doctor: roles.includes('doctor'),
});

type NamedMember = Pick<
  ClinicMemberRead,
  'last_name' | 'first_name' | 'middle_name' | 'email'
>;

/** «Фамилия Имя Отчество»; без ФИО — почта. */
export const formatMemberName = (member: NamedMember): string => {
  const name = [member.last_name, member.first_name, member.middle_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');

  return name || member.email || '';
};

/** Разбор поля «ФИО»: фамилия, имя и всё остальное — отчество. */
export const parseFullName = (
  text: string,
): Pick<ClinicMemberPatch, 'last_name' | 'first_name' | 'middle_name'> => {
  const parts = text.trim().split(/\s+/).filter(Boolean);

  return {
    last_name: parts[0] ?? null,
    first_name: parts[1] ?? null,
    middle_name: parts.slice(2).join(' ') || null,
  };
};

/** Список без отключённых: сначала работающие, затем приглашённые. */
export const visibleMembers = (
  members: ClinicMemberRead[],
): ClinicMemberRead[] => [
  ...members.filter((member) => member.status === 'active'),
  ...members.filter((member) => member.status === 'invited'),
];

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

/** Поиск по ФИО и почте без учёта регистра. */
export const filterMembers = (
  members: ClinicMemberRead[],
  query: string,
): ClinicMemberRead[] => {
  const needle = normalize(query);
  if (!needle) return members;

  return members.filter(
    (member) =>
      normalize(formatMemberName(member)).includes(needle) ||
      normalize(member.email ?? '').includes(needle),
  );
};

export interface ClinicAdminOption {
  value: string;
  label: string;
  /** Админ без роли врача: снять нельзя — у сотрудника не останется ролей. */
  disabled: boolean;
}

/** Опции поля «Администраторы»: работающие сотрудники клиники. */
export const clinicAdminOptions = (
  members: ClinicMemberRead[],
): { options: ClinicAdminOption[]; selected: string[] } => {
  const active = members.filter(
    (member) => member.kind === 'membership' && member.status === 'active',
  );

  return {
    options: active.map((member) => ({
      value: member.id,
      label: formatMemberName(member),
      disabled: member.is_clinic_admin && !member.is_doctor,
    })),
    selected: active
      .filter((member) => member.is_clinic_admin)
      .map((member) => member.id),
  };
};

export const canAddDoctor = (
  clinic: Pick<ClinicRead, 'doctors_count' | 'doctors_limit'>,
): boolean => clinic.doctors_count < clinic.doctors_limit;

export type MemberRolesChange =
  | { kind: 'patch'; data: ClinicMemberPatch }
  | { kind: 'needs_specialization' }
  | { kind: 'no_roles' }
  | { kind: 'unchanged' };

/**
 * Что отправить при смене ролей сотрудника.
 *
 * Backend не проверяет «врач без специализаций», если в запросе нет
 * `specialization_ids`, поэтому «Врач» включается только вместе с ними.
 */
export const buildMemberRolesPatch = (
  member: MemberFlags,
  roles: MemberRole[],
  specializationIds: number[],
): MemberRolesChange => {
  const flags = memberRolesToFlags(roles);
  if (!flags.is_clinic_admin && !flags.is_doctor) return { kind: 'no_roles' };

  if (
    flags.is_clinic_admin === member.is_clinic_admin &&
    flags.is_doctor === member.is_doctor
  ) {
    return { kind: 'unchanged' };
  }

  if (flags.is_doctor && !member.is_doctor) {
    if (specializationIds.length === 0) return { kind: 'needs_specialization' };
    return {
      kind: 'patch',
      data: { ...flags, specialization_ids: specializationIds },
    };
  }

  return { kind: 'patch', data: flags };
};

// --- Ошибки -----------------------------------------------------------------

/** Текст ошибки приглашения по статусу и `detail` ответа backend. */
export const inviteErrorMessage = (
  status: number | undefined,
  detail: string | undefined,
): string => {
  const text = detail ?? '';

  if (status === 409) {
    if (text.startsWith('Лимит')) return 'Достигнут лимит врачей клиники';
    if (/pending/i.test(text)) return 'Приглашение на эту почту уже отправлено';
    return 'Пользователь с такой почтой уже зарегистрирован';
  }
  if (status === 400 && /specialization/i.test(text)) {
    return 'Для врача выберите специализацию';
  }
  if (status === 403) return 'Нет доступа к клинике';
  if (status === 404) return 'Клиника не найдена';

  return 'Не удалось отправить приглашение';
};
