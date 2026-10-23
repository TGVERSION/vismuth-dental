// Помощник «Обоснование для ДМС»: что уходит в модель, как читается ответ и
// что показать врачу при отказе. Решения без React, сети и стора — их
// проверяют тесты, а хук useDmsJustification только связывает их с экраном.
//
// В модель уходят только основной диагноз и разделы помощника. Остальные
// поля протокола не отправляются: в структуре врача могут быть ФИО, полис и
// другие персональные данные, а для обоснования назначений они не нужны.

import type { DmsJustifyRequest, DmsJustifyResponse } from '@/api';
import type { DraftSection } from './protocol-draft';
import {
  findDmsTargetSections,
  findMainDiagnosisValue,
} from './protocol-fields';

/**
 * Ключ раздела в запросе. `sectionKey` не годится: имя поля в структуре
 * протокола не обязано быть уникальным, а `id` раздела в форме уникален.
 */
export const dmsSectionKey = (section: Pick<DraftSection, 'id'>): string =>
  String(section.id);

/**
 * Запрос к помощнику или `null`, если обосновывать нечего: нет диагноза или
 * разделы «Рекомендации» и «Назначения» не найдены либо пусты. По этому же
 * признаку показывается кнопка.
 */
export const buildDmsRequest = (
  sections: DraftSection[],
): DmsJustifyRequest | null => {
  const diagnosis = findMainDiagnosisValue(sections)?.trim();
  const targets = findDmsTargetSections(sections).filter((section) =>
    section.value.trim(),
  );
  if (!diagnosis || targets.length === 0) return null;

  return {
    main_diagnosis: diagnosis,
    sections: targets.map((section) => ({
      key: dmsSectionKey(section),
      field_id: section.fieldMeta?.id || undefined,
      label: section.label,
      value: section.value,
    })),
  };
};

/** Предложение помощника для одного раздела. */
export interface DmsProposal {
  sectionId: number;
  /** Текст раздела в момент запуска. */
  original: string;
  /** Новый текст раздела целиком. */
  proposal: string;
}

/**
 * Предложения по разделам из ответа. Ключи сверяются с запросом: раздел, о
 * котором не спрашивали, и пустой ответ отбрасываются. Раздел, который
 * помощник вернул без изменений, остаётся обычным полем.
 */
export const mapDmsResponse = (
  request: DmsJustifyRequest,
  response: DmsJustifyResponse,
): DmsProposal[] => {
  const adapted = new Map<string, string>();
  (response.sections ?? []).forEach((section) => {
    if (typeof section?.adapted_text === 'string') {
      adapted.set(section.key, section.adapted_text);
    }
  });

  return request.sections.flatMap((section) => {
    const proposal = adapted.get(section.key);
    if (proposal === undefined) return [];
    if (!proposal.trim() || proposal.trim() === section.value.trim()) return [];
    return [
      { sectionId: Number(section.key), original: section.value, proposal },
    ];
  });
};

export type DmsFailure =
  /** Клинрека для диагноза нет — сообщение у поля диагноза, без повтора. */
  | { kind: 'nofound'; reason: 'guideline_not_found' | 'mkb_required' }
  /** Помощник недоступен: повтор не поможет. */
  | { kind: 'unavailable'; message: string }
  /** Сбой сервиса или сети: можно повторить. */
  | { kind: 'error'; message: string };

export const DMS_ERROR_MESSAGE =
  'Не удалось обосновать для ДМС: сервис не ответил. Текст раздела не изменён.';
export const DMS_SUBSCRIPTION_MESSAGE =
  'Подписка клиники истекла — обоснование для ДМС недоступно.';
export const DMS_NOT_DEPLOYED_MESSAGE =
  'Помощник пока недоступен на этом сервере.';
export const DMS_NOTHING_TO_ADD_MESSAGE =
  'Дополнять нечего: назначения уже соответствуют клиническим рекомендациям.';

/**
 * Что показать по ошибке запроса. Сначала машинный код из `detail.code`,
 * потом статус: «клинрек не найден» backend может вернуть и с 404 (как
 * resolve каталога), и с 422 (как ml_clinrec_check).
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
        'Клинические рекомендации подбираются по коду, поэтому обосновать назначения для ДМС не по чему. Протокол не изменён.',
      hint: 'Выберите диагноз из справочника МКБ-10 и запустите снова.',
    };
  }

  const code = extractMkbCode(diagnosis);
  return {
    title: code
      ? `Для диагноза ${code} нет клинических рекомендаций.`
      : 'Для этого диагноза нет клинических рекомендаций.',
    details: 'Обосновать назначения для ДМС не по чему, протокол не изменён.',
    hint: 'Уточните диагноз и запустите снова или укажите показания к назначениям вручную.',
  };
};

/**
 * Шаги ожидания. Сервер о ходе работы не сообщает, поэтому шаг выбирается по
 * прошедшему времени: ответ приходит за десятки секунд, и короткие интервалы
 * быстро довели бы до последнего шага задолго до конца.
 */
export const DMS_STEPS: readonly { text: string; fromMs: number }[] = [
  { text: 'Подбираем клинические рекомендации по диагнозу', fromMs: 0 },
  { text: 'Ищем обоснование для каждого назначения', fromMs: 8_000 },
  { text: 'Дополняем текст раздела', fromMs: 20_000 },
];

export const dmsStepAt = (elapsedMs: number): number => {
  let step = 0;
  DMS_STEPS.forEach((item, index) => {
    if (elapsedMs >= item.fromMs) step = index;
  });
  return step;
};
