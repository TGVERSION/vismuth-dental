// Чистая логика раздела «Анкеты пациентов» у регистратуры: статусы, форма
// новой ссылки, доступные действия. Всё, что можно проверить без браузера.

import type {
  RegistryQuestionnaireCreate,
  RegistryQuestionnaireCreated,
  RegistryQuestionnaireItem,
  RegistryStatus,
} from '@/api';
import { normalizeQrUrl } from './qr';
import { qrFileName, type QuestionnaireLinkItem } from './questionnaire-links';

/** Сколько дней работает ссылка — как на backend (`INVITE_TTL_DAYS`). */
export const INVITE_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Даты

/** «12.10.2026 в 20:41» в часовом поясе браузера регистратуры (или заданном). */
export const formatDateTime = (iso: string, timeZone?: string): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} в ${parts.hour}:${parts.minute}`;
};

/**
 * Строка под ФИО: когда пациент заполнил анкету или до какого времени
 * работает ссылка. Анкета не привязана к дате приёма — регистратура ищет
 * её по ФИО.
 */
export const registryWhenLine = (
  item: RegistryQuestionnaireItem,
  now: Date = new Date(),
  timeZone?: string,
): string => {
  if (item.completed_at)
    return `Заполнена ${formatDateTime(item.completed_at, timeZone)}`;
  if (!item.invite_expires_at) return '';
  if (new Date(item.invite_expires_at) <= now) return 'Ссылка устарела';
  return `Ссылка действует до ${formatDateTime(item.invite_expires_at, timeZone)}`;
};

// ---------------------------------------------------------------------------
// Статус

export interface RegistryStatusView {
  label: string;
  /** Классы плашки статуса. */
  className: string;
}

const STATUS_VIEW: Record<RegistryStatus, RegistryStatusView> = {
  invited: {
    label: 'Ссылка отправлена',
    className: 'bg-[#F1F2F6] text-[#6C757D]',
  },
  in_progress: {
    label: 'Заполняется',
    className: 'bg-[#FFF4DB] text-[#8A5A00]',
  },
  completed: { label: 'Заполнена', className: 'bg-[#EAF0FB] text-[#2A5AB0]' },
  printed: { label: 'Распечатана', className: 'bg-[#F3ECFC] text-[#6A3FA6]' },
  signed: { label: 'Подписана', className: 'bg-[#E6F4EC] text-[#14603B]' },
};

export const registryStatusView = (
  status: RegistryStatus,
): RegistryStatusView => STATUS_VIEW[status];

export const REGISTRY_STATUS_OPTIONS: {
  value: RegistryStatus | '';
  label: string;
}[] = [
  { value: '', label: 'Все статусы' },
  ...(Object.keys(STATUS_VIEW) as RegistryStatus[]).map((value) => ({
    value,
    label: STATUS_VIEW[value].label,
  })),
];

export interface RegistryActions {
  /** Новая ссылка взамен прежней — пока анкета не заполнена. */
  canResendLink: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canMarkSigned: boolean;
}

export const registryActions = (status: RegistryStatus): RegistryActions => {
  const isOpen = status === 'invited' || status === 'in_progress';
  return {
    canResendLink: isOpen,
    canDelete: isOpen,
    canPrint: !isOpen,
    canMarkSigned: status === 'completed' || status === 'printed',
  };
};

// ---------------------------------------------------------------------------
// Имена

const joinName = (...parts: (string | null | undefined)[]): string =>
  parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

export const patientFullName = (item: RegistryQuestionnaireItem): string =>
  joinName(
    item.patient_last_name,
    item.patient_first_name,
    item.patient_middle_name,
  );

// ---------------------------------------------------------------------------
// Форма новой ссылки: только ФИО — как бумажная анкета, ссылка не привязана
// ни к врачу, ни к дате приёма.

export interface NewLinkForm {
  lastName: string;
  firstName: string;
  middleName: string;
}

export const EMPTY_NEW_LINK: NewLinkForm = Object.freeze({
  lastName: '',
  firstName: '',
  middleName: '',
});

export type NewLinkErrors = Partial<Record<keyof NewLinkForm, string>>;

export const validateNewLink = (form: NewLinkForm): NewLinkErrors => {
  const errors: NewLinkErrors = {};
  if (!form.lastName.trim()) errors.lastName = 'Укажите фамилию';
  if (!form.firstName.trim()) errors.firstName = 'Укажите имя';
  return errors;
};

export const buildNewLinkPayload = (
  form: NewLinkForm,
): RegistryQuestionnaireCreate => ({
  last_name: form.lastName.trim(),
  first_name: form.firstName.trim(),
  middle_name: form.middleName.trim() || null,
});

/**
 * Карточка новой ссылки для `LinkQrCard`: адрес, QR и имя файла. В имени
 * файла — id анкеты, а не фамилия: файл может уйти дальше регистратуры.
 */
export const inviteLinkItem = (
  created: RegistryQuestionnaireCreated,
): QuestionnaireLinkItem => ({
  kind: 'invite',
  title: patientFullName(created),
  description: `Ссылка работает ${INVITE_TTL_DAYS} дней. Отправьте её пациенту — она показывается один раз.`,
  url: created.url,
  qrText: normalizeQrUrl(created.url),
  fileName: qrFileName('invite', created.id),
});
