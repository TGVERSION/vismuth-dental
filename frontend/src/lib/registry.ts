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
 * Строка под ФИО: только дата заполнения; до завершения строки нет.
 */
export const registryWhenLine = (
  item: RegistryQuestionnaireItem,
  timeZone?: string,
): string => {
  if (!item.completed_at) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(new Date(item.completed_at));
};

/** Группы в порядке выдачи сервера, по тем же местным суткам, что и фильтр. */
export const groupRegistryByCompletionDay = (
  items: RegistryQuestionnaireItem[],
  utcOffsetMinutes: number,
) => {
  const groups = new Map<string, RegistryQuestionnaireItem[]>();
  for (const item of items) {
    if (!item.completed_at) continue;
    const timestamp = Date.parse(item.completed_at);
    if (!Number.isFinite(timestamp)) continue;
    const day = new Date(timestamp + utcOffsetMinutes * 60_000)
      .toISOString()
      .slice(0, 10);
    const group = groups.get(day);
    if (group) group.push(item);
    else groups.set(day, [item]);
  }
  return [...groups];
};

// ---------------------------------------------------------------------------
// Статус

// Цвета плашки — в `components/registry/RegistryStatusBadge.tsx`: папка
// `lib/` в .gitignore, и Tailwind не собирает классы из её файлов.
export interface RegistryStatusView {
  label: string;
}

const STATUS_VIEW: Record<RegistryStatus, RegistryStatusView> = {
  invited: { label: 'Ссылка отправлена' },
  in_progress: { label: 'Заполняется' },
  completed: { label: 'Заполнена' },
  printed: { label: 'Распечатана' },
  signed: { label: 'Подписана' },
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
// Форма новой ссылки: ФИО и дата рождения — ссылка не привязана
// ни к врачу, ни к дате приёма.

export const buildNewLinkPayload = (
  fullName: string,
  birthDate: string,
): RegistryQuestionnaireCreate | null => {
  const [lastName, firstName, ...middleNameParts] = fullName.trim().split(/\s+/);
  if (!lastName || !firstName) return null;
  return {
    last_name: lastName,
    first_name: firstName,
    middle_name: middleNameParts.join(' ') || null,
    ...(birthDate ? { birth_date: birthDate } : {}),
  };
};

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
