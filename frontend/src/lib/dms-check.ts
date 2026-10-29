// Помощник «Проверка для ДМС»: что уходит на проверку, как читается ответ и
// что показать врачу при отказе. Решения без React, сети и стора — их
// проверяют тесты, а хук useDmsCheck только связывает их с экраном.
//
// На проверку уходят только основной диагноз и текст разделов «Рекомендации»
// и «Назначения». Остальные поля протокола не отправляются: в структуре врача
// могут быть ФИО, полис и другие персональные данные, а для проверки
// назначений они не нужны.
//
// Ответ (docs/contracts/check-dms.md) не переписывает текст: он режет
// исходный текст раздела на части и отмечает назначения, которых нет в
// клинических рекомендациях. Врач решает, убрать отмеченное или оставить.

import type {
  CheckDmsFragment,
  CheckDmsRequest,
  CheckDmsResponse,
  CheckDmsSegment,
} from '@/api';
import type { DraftSection } from './protocol-draft';
import {
  findDmsTargetSections,
  findMainDiagnosisValue,
} from './protocol-fields';

/** Ограничение backend на текст назначений. */
export const DMS_APPOINTMENTS_MAX_LENGTH = 4000;

/** Раздел, который уходит на проверку. */
export interface DmsTarget {
  sectionId: number;
  label: string;
  /** Текст раздела без пробелов по краям — так его видит backend. */
  value: string;
}

export interface DmsPlan {
  /** Строка диагноза: код МКБ и название. */
  mkb: string;
  targets: DmsTarget[];
}

/**
 * Что проверять, или `null`, если нечего: нет диагноза или разделы
 * «Рекомендации» и «Назначения» не найдены либо пусты. По этому же признаку
 * показывается кнопка.
 */
export const buildDmsPlan = (sections: DraftSection[]): DmsPlan | null => {
  const mkb = findMainDiagnosisValue(sections)?.trim();
  const targets = findDmsTargetSections(sections)
    .map((section) => ({
      sectionId: section.id,
      label: section.label,
      value: section.value.trim(),
    }))
    .filter((target) => target.value);
  if (!mkb || targets.length === 0) return null;
  return { mkb, targets };
};

export const dmsRequestFor = (
  plan: DmsPlan,
  target: DmsTarget,
): CheckDmsRequest => ({ mkb: plan.mkb, appointments: target.value });

/** Первый раздел, который backend не примет из-за длины. */
export const findTooLongTarget = (plan: DmsPlan): DmsTarget | null =>
  plan.targets.find(
    (target) => target.value.length > DMS_APPOINTMENTS_MAX_LENGTH,
  ) ?? null;

/** Итог проверки одного раздела, где есть отмеченные назначения. */
export interface DmsFinding {
  sectionId: number;
  /** Текст раздела в момент запуска. */
  original: string;
  segments: CheckDmsSegment[];
  fragments: CheckDmsFragment[];
  guidelineTitle: string | null;
  /** Сколько назначений отмечено. */
  unnecessaryCount: number;
  /** Текст раздела без отмеченных назначений — его записывает «Убрать». */
  cleaned: string;
}

/** Части ответа не складываются в текст раздела — подсветка была бы ложной. */
export class DmsResponseMismatchError extends Error {
  constructor() {
    super('check_dms: segments do not match appointments text');
    this.name = 'DmsResponseMismatchError';
  }
}

/**
 * Итог проверки раздела или `null`, если лишних назначений нет. Склейка
 * частей ответа обязана совпасть с отправленным текстом, иначе отметки
 * относились бы не к тем словам.
 */
export const mapDmsResponse = (
  target: DmsTarget,
  response: CheckDmsResponse,
): DmsFinding | null => {
  const segments = (response.appointments ?? []).filter(
    (segment) => typeof segment?.text === 'string',
  );
  if (segments.map((segment) => segment.text).join('') !== target.value) {
    throw new DmsResponseMismatchError();
  }

  const unnecessaryCount = segments.filter(
    (segment) => segment.unnecessary && segment.text.trim(),
  ).length;
  if (unnecessaryCount === 0) return null;

  return {
    sectionId: target.sectionId,
    original: target.value,
    segments,
    fragments: (response.fragments ?? []).filter(
      (fragment) => typeof fragment?.text === 'string' && fragment.text.trim(),
    ),
    guidelineTitle: response.guideline_title?.trim() || null,
    unnecessaryCount,
    cleaned: removeUnnecessary(segments),
  };
};

// Место убранного назначения внутри строки. Символ не встречается в тексте
// протокола: он не печатается и не вводится с клавиатуры.
const GAP = '\u0000';
const GAP_RE = /([,;])?[ \t]*\u0000+[ \t]*([,;])?/g;
// Строка, где после удаления остались только номер пункта и знаки.
const LEFTOVER_LINE_RE = /^[\s\d.,;:()\-–—•*]*$/;

/**
 * Текст без отмеченных назначений. Разделители вокруг убранного пункта
 * схлопываются («А, Б, В» без Б → «А, В»), строка, от которой остался только
 * номер, удаляется. Строки, где ничего не убрано, не меняются.
 */
export const removeUnnecessary = (segments: CheckDmsSegment[]): string => {
  const marked = segments
    .map((segment) => (segment.unnecessary ? GAP : segment.text))
    .join('');

  return marked
    .split('\n')
    .flatMap((line) => {
      if (!line.includes(GAP)) return [line];
      const joined = line
        .replace(GAP_RE, (_match, before?: string, after?: string) => {
          if (before && after) return before;
          return before || after ? '' : ' ';
        })
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      return LEFTOVER_LINE_RE.test(joined) ? [] : [joined];
    })
    .join('\n')
    .trim();
};

export type DmsFailure =
  /** Клинрека для диагноза нет — сообщение у поля диагноза, без повтора. */
  | { kind: 'nofound'; reason: 'guideline_not_found' | 'mkb_required' }
  /** Проверка недоступна: повтор не поможет. */
  | { kind: 'unavailable'; message: string }
  /** Сбой сервиса или сети: можно повторить. */
  | { kind: 'error'; message: string };

export const DMS_ERROR_MESSAGE =
  'Не удалось проверить для ДМС: сервис не ответил. Текст раздела не изменён.';
export const DMS_SUBSCRIPTION_MESSAGE =
  'Подписка клиники истекла — проверка для ДМС недоступна.';
export const DMS_NOT_DEPLOYED_MESSAGE =
  'Проверка для ДМС пока недоступна на этом сервере.';
export const DMS_GUIDELINE_FILE_MESSAGE =
  'Файл клинических рекомендаций для этого диагноза не открылся. Сообщите администратору.';
export const DMS_ALL_CONFIRMED_MESSAGE =
  'Лишних назначений нет: всё подтверждается клиническими рекомендациями.';

export const tooLongMessage = (label: string): string =>
  `Раздел «${label}» длиннее ${DMS_APPOINTMENTS_MAX_LENGTH} знаков. Сократите его и запустите проверку снова.`;

/**
 * Что показать по ошибке запроса. Сначала машинный код из `detail.code`,
 * потом статус.
 */
export const classifyDmsError = (
  error: { status?: number; code?: string | null } | null,
): DmsFailure => {
  const code = error?.code ?? null;
  if (code === 'guideline_not_found' || code === 'mkb_required') {
    return { kind: 'nofound', reason: code };
  }
  if (code === 'subscription_expired') {
    return { kind: 'unavailable', message: DMS_SUBSCRIPTION_MESSAGE };
  }
  if (code === 'pdf_invalid' || code === 's3_object_not_found') {
    return { kind: 'unavailable', message: DMS_GUIDELINE_FILE_MESSAGE };
  }
  if (error?.status === 404) {
    return { kind: 'unavailable', message: DMS_NOT_DEPLOYED_MESSAGE };
  }
  return { kind: 'error', message: DMS_ERROR_MESSAGE };
};

/** Ведущий код МКБ из строки диагноза — как `extract_mkb_code` в backend. */
export const extractMkbCode = (diagnosis: string): string | null => {
  const match = /^([A-Za-z]\d{2}(?:\.\d{1,4})?)/.exec(diagnosis.trim());
  return match ? match[1].toUpperCase() : null;
};

export interface DmsNoGuidelineText {
  title: string;
  details: string;
  hint: string;
}

/** Текст сообщения у поля диагноза. */
export const noGuidelineText = (
  reason: 'guideline_not_found' | 'mkb_required',
  diagnosis: string,
): DmsNoGuidelineText => {
  if (reason === 'mkb_required') {
    return {
      title: 'В диагнозе нет кода МКБ-10.',
      details:
        'Клинические рекомендации подбираются по коду, поэтому проверить назначения для ДМС не по чему. Протокол не изменён.',
      hint: 'Выберите диагноз из справочника МКБ-10 и запустите снова.',
    };
  }

  const code = extractMkbCode(diagnosis);
  return {
    title: code
      ? `Для диагноза ${code} нет клинических рекомендаций.`
      : 'Для этого диагноза нет клинических рекомендаций.',
    details: 'Проверить назначения для ДМС не по чему, протокол не изменён.',
    hint: 'Уточните диагноз и запустите снова или проверьте назначения вручную.',
  };
};

/**
 * Шаги ожидания. Сервер о ходе работы не сообщает, поэтому шаг выбирается по
 * прошедшему времени: ответ приходит за десятки секунд, и короткие интервалы
 * быстро довели бы до последнего шага задолго до конца.
 */
export const DMS_STEPS: readonly { text: string; fromMs: number }[] = [
  { text: 'Подбираем клинические рекомендации по диагнозу', fromMs: 0 },
  { text: 'Сверяем назначения с клиническими рекомендациями', fromMs: 8_000 },
  { text: 'Отмечаем назначения без обоснования', fromMs: 20_000 },
];

export const dmsStepAt = (elapsedMs: number): number => {
  let step = 0;
  DMS_STEPS.forEach((item, index) => {
    if (elapsedMs >= item.fromMs) step = index;
  });
  return step;
};
