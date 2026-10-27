// Лист А4 анкеты для подписи пациента: что на нём напечатано.
//
// На листе — только то, что ответил пациент, и данные приёма: под листом
// пациент расписывается «ответы верны». Поэтому «Самое важное» здесь — факты
// без предупреждений врачу (`important_facts`), а «Что доспросить» не идёт
// вовсе: это подсказки врачу, а не ответы пациента.

import type { RegistryQuestionnaireDetail } from '@/api';
import { patientFullName } from './registry';

export const ATTESTATION =
  'Я заполнил(а) анкету сам(а), ответы верны. Я сообщу врачу, если состояние ' +
  'здоровья или список лекарств изменится.';

export interface PrintHealthRow {
  label: string;
  has: boolean;
  detail: string;
}

export interface PrintSheet {
  clinicName: string;
  /** «Заполнена 12.10.2026 в 20:41»; пусто, если анкета не заполнена. */
  filled: string;
  patient: string;
  doctor: string;
  /** «14.10.2026, 14:30». */
  appointment: string;
  important: string[];
  complaints: string;
  health: PrintHealthRow[];
  attestation: string;
}

/** «14.10.2026» из YYYY-MM-DD — по частям, без сдвига часового пояса. */
export const formatDate = (isoDate: string | null): string => {
  const match = isoDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
};

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

export const printSheet = (
  detail: RegistryQuestionnaireDetail,
  clinicName: string,
  timeZone?: string,
): PrintSheet => {
  const structured = detail.structured;
  const appointment = [formatDate(detail.appointment_date), detail.appointment_time]
    .filter(Boolean)
    .join(', ');
  return {
    clinicName,
    filled: detail.completed_at ? `Заполнена ${formatDateTime(detail.completed_at, timeZone)}` : '',
    patient: patientFullName(detail),
    doctor: detail.doctor_name ?? '',
    appointment,
    important: structured?.important_facts ?? [],
    complaints: structured?.complaints ?? '',
    health: (structured?.health ?? []).map(({ label, has, detail: text }) => ({ label, has, detail: text })),
    attestation: ATTESTATION,
  };
};
