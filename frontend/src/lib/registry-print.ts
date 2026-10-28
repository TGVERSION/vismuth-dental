// Лист А4 анкеты для подписи пациента: что на нём напечатано.
//
// Лист повторяет обычную стоматологическую «Анкету о состоянии здоровья»:
// ФИО и дата рождения пациента, ответы, заявление и подпись с датой. Врача и
// приёма на бумажной анкете нет — нет и здесь.
//
// На листе — только то, что ответил пациент: под ним пациент расписывается
// «ответы верны». Поэтому «Самое важное» — факты без предупреждений врачу
// (`important_facts`), а «Что доспросить» не идёт вовсе: это подсказки врачу.

import type { DentalHistory, RegistryQuestionnaireDetail } from '@/api';
import { formatDateTime, patientFullName } from './registry';

/** Заявление пациента над подписью — как в бумажных анкетах клиник. */
export const ATTESTATION: readonly string[] = Object.freeze([
  'Я ответил(а) на вопросы анкеты сам(а) и правдиво.',
  'Мне известно, что результат лечения зависит от состояния моего здоровья.',
  'Если состояние здоровья изменится или я начну принимать новые лекарства, я сообщу об этом врачу.',
  'Мне известно, что при неполных или неверных сведениях о болезнях и операциях клиника не отвечает за последствия.',
]);

export interface PrintHealthRow {
  label: string;
  has: boolean;
  detail: string;
}

/** Стоматологический анамнез, как в бумажном бланке. */
export interface PrintDentalHistory {
  lastVisit: string;
  signs: PrintHealthRow[];
  complications: string;
}

export interface PrintSheet {
  clinicName: string;
  /** «Заполнена 12.10.2026 в 20:41»; пусто, если анкета не заполнена. */
  filled: string;
  patient: string;
  important: string[];
  complaints: string;
  health: PrintHealthRow[];
  /** Null — анкета заполнена до шага «Зубы и дёсны». */
  dentalHistory: PrintDentalHistory | null;
  /** Вопросы нейросети и ответы пациента дословно. */
  clarifications: { question: string; answer: string }[];
  attestation: readonly string[];
}

const NO_ANSWER = 'Пациент не ответил';

const printDentalHistory = (
  history: DentalHistory | undefined,
): PrintDentalHistory | null =>
  history
    ? {
        lastVisit: history.last_visit || 'Не указан',
        signs: history.signs.map(({ label, has }) => ({ label, has, detail: '' })),
        complications: history.complications || 'Не было',
      }
    : null;

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
    dentalHistory: printDentalHistory(structured?.dental_history),
    clarifications: (structured?.clarifications ?? []).map(
      ({ question, answer }) => ({
        question,
        answer: answer || NO_ANSWER,
      }),
    ),
    attestation: ATTESTATION,
  };
};
