// Лист А4 анкеты для подписи пациента: что на нём напечатано.
//
// Лист повторяет обычную стоматологическую «Анкету о состоянии здоровья»:
// ФИО и дата рождения пациента, ответы, заявление и подпись с датой. Врача и
// приёма на бумажной анкете нет — нет и здесь.
//
// На листе — только то, что ответил пациент: под ним пациент расписывается
// «ответы верны». Поэтому «Самое важное» — факты без предупреждений врачу
// (`important_facts`), а «Что доспросить» не идёт вовсе: это подсказки врачу.

import type { RegistryQuestionnaireDetail } from '@/api';
import { formatDateTime, patientFullName } from './registry';

/** Заявление пациента над подписью — как в бумажных анкетах клиник. */
export const ATTESTATION: readonly string[] = Object.freeze([
  'Я ответил(а) на вопросы анкеты сам(а) и правдиво.',
  'Мне известно, что результат лечения зависит от состояния моего здоровья.',
  'Если состояние здоровья изменится или я начну принимать новые лекарства, я сообщу об этом врачу.',
]);

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
  important: string[];
  complaints: string;
  health: PrintHealthRow[];
  /** Вопросы нейросети и ответы пациента дословно. */
  clarifications: { question: string; answer: string }[];
  attestation: readonly string[];
}

const NO_ANSWER = 'Пациент не ответил';

export const printSheet = (
  detail: RegistryQuestionnaireDetail,
  clinicName: string,
  timeZone?: string,
): PrintSheet => {
  const structured = detail.structured;
  return {
    clinicName,
    filled: detail.completed_at
      ? `Заполнена ${formatDateTime(detail.completed_at, timeZone)}`
      : '',
    patient: patientFullName(detail),
    important: structured?.important_facts ?? [],
    complaints: structured?.complaints ?? '',
    health: (structured?.health ?? []).map(({ label, has, detail: text }) => ({
      label,
      has,
      detail: text,
    })),
    clarifications: (structured?.clarifications ?? []).map(
      ({ question, answer }) => ({
        question,
        answer: answer || NO_ANSWER,
      }),
    ),
    attestation: ATTESTATION,
  };
};
