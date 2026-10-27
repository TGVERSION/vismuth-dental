// Чистая логика раздела «Анкеты пациентов» у регистратуры: статусы, форма
// новой ссылки, доступные действия. Всё, что можно проверить без браузера.

import type {
  ClinicMemberRead,
  RegistryQuestionnaireCreate,
  RegistryQuestionnaireCreated,
  RegistryQuestionnaireItem,
  RegistryStatus,
} from '@/api';
import { appointmentLine } from './dental-questionnaire';
import { normalizeQrUrl } from './qr';
import { qrFileName, type QuestionnaireLinkItem } from './questionnaire-links';

/** Насколько вперёд можно записать — как на backend. */
export const REGISTRY_DAYS_AHEAD = 30;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Статус

export interface RegistryStatusView {
  label: string;
  /** Классы плашки статуса. */
  className: string;
}

const STATUS_VIEW: Record<RegistryStatus, RegistryStatusView> = {
  invited: { label: 'Ссылка отправлена', className: 'bg-[#F1F2F6] text-[#6C757D]' },
  in_progress: { label: 'Заполняется', className: 'bg-[#FFF4DB] text-[#8A5A00]' },
  completed: { label: 'Заполнена', className: 'bg-[#EAF0FB] text-[#2A5AB0]' },
  printed: { label: 'Распечатана', className: 'bg-[#F3ECFC] text-[#6A3FA6]' },
  signed: { label: 'Подписана', className: 'bg-[#E6F4EC] text-[#14603B]' },
};

export const registryStatusView = (status: RegistryStatus): RegistryStatusView =>
  STATUS_VIEW[status];

export const REGISTRY_STATUS_OPTIONS: { value: RegistryStatus | ''; label: string }[] = [
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
  joinName(item.patient_last_name, item.patient_first_name, item.patient_middle_name);

export interface DoctorOption {
  value: string;
  label: string;
}

/** Врачи для записи: только принятые и активные, по фамилии. */
export const doctorOptions = (members: readonly ClinicMemberRead[]): DoctorOption[] =>
  members
    .filter((m) => m.kind === 'membership' && m.status === 'active' && m.is_doctor)
    .map((m) => ({ value: m.id, label: joinName(m.last_name, m.first_name, m.middle_name) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

// ---------------------------------------------------------------------------
// Форма новой ссылки

export interface NewLinkForm {
  lastName: string;
  firstName: string;
  middleName: string;
  doctorId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM. */
  time: string;
}

export const EMPTY_NEW_LINK: NewLinkForm = Object.freeze({
  lastName: '',
  firstName: '',
  middleName: '',
  doctorId: '',
  date: '',
  time: '',
});

export type NewLinkErrors = Partial<Record<keyof NewLinkForm, string>>;

/** Сдвиг даты YYYY-MM-DD на дни, без часовых поясов. */
const addDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
};

export const validateNewLink = (form: NewLinkForm, today: string): NewLinkErrors => {
  const errors: NewLinkErrors = {};
  if (!form.lastName.trim()) errors.lastName = 'Укажите фамилию';
  if (!form.firstName.trim()) errors.firstName = 'Укажите имя';
  if (!form.doctorId) errors.doctorId = 'Выберите врача';
  if (!DATE_RE.test(form.date)) {
    errors.date = 'Укажите дату приёма';
  } else if (form.date < today || form.date > addDays(today, REGISTRY_DAYS_AHEAD)) {
    errors.date = `Дата приёма — от сегодня до ${REGISTRY_DAYS_AHEAD} дней вперёд`;
  }
  if (!TIME_RE.test(form.time)) errors.time = 'Время в формате ЧЧ:ММ';
  return errors;
};

export const buildNewLinkPayload = (form: NewLinkForm): RegistryQuestionnaireCreate => ({
  doctor_membership_id: form.doctorId,
  last_name: form.lastName.trim(),
  first_name: form.firstName.trim(),
  middle_name: form.middleName.trim() || null,
  appointment_date: form.date,
  appointment_time: form.time,
});

/**
 * Карточка новой ссылки для `LinkQrCard`: адрес, QR и имя файла. В имени
 * файла — id анкеты, а не фамилия: файл может уйти дальше регистратуры.
 */
export const inviteLinkItem = (
  created: RegistryQuestionnaireCreated,
): QuestionnaireLinkItem => {
  const appointment = appointmentLine(created.appointment_date, created.appointment_time);
  return {
    kind: 'invite',
    title: patientFullName(created),
    description: `${appointment ? `${appointment}. ` : ''}Отправьте ссылку пациенту — она показывается один раз.`,
    url: created.url,
    qrText: normalizeQrUrl(created.url),
    fileName: qrFileName('invite', created.id),
  };
};
