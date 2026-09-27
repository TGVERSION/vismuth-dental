// Применение расшифровки приёма к полям протокола и откат применённого.
//
// Результат распознавания ложится в форму сразу, без подтверждения врача, —
// поэтому безопасность здесь строится не на вопросе «применить?», а на двух
// правилах:
//
// 1. Ручной текст физически не удаляется. Поле, которое врач уже заполнил,
//    получает текст из записи в конец, а не вместо своего.
// 2. Каждое изменение обратимо: вместе с новым значением сохраняется снимок
//    прежнего, по которому поле возвращается одним действием.
//
// Пустое значение от сервера не применяется никогда: «в приёме про это не
// говорили» не должно превращаться в стирание того, что врач написал сам.

import type { DraftSection } from './protocol-draft';

/** Что именно случилось с одним полем при применении расшифровки. */
export interface VoiceFillEntry {
  /** `id` раздела формы — по нему подсвечивается поле и делается откат. */
  sectionId: number;
  /** UUID поля структуры протокола: ключ, которым оперирует сервер. */
  fieldId: string;
  label: string;
  /** Значение до применения. Материал для отката. */
  previous: string;
  /** Значение после применения. */
  applied: string;
  /** `fill` — поле было пустым, `append` — текст дописан к тексту врача. */
  mode: 'fill' | 'append';
}

export interface VoiceFillResult {
  sections: DraftSection[];
  entries: VoiceFillEntry[];
}

/**
 * Склейка текста врача с текстом из записи.
 * Разделяются пустой строкой: врачу должно быть видно, где заканчивается его
 * формулировка и начинается расшифровка.
 */
export const appendText = (current: string, incoming: string): string => {
  const left = current.trimEnd();
  const right = incoming.trim();

  if (!left) return right;
  if (!right) return left;
  // Повторное применение того же текста не должно плодить дубли.
  if (left.endsWith(right)) return left;

  return `${left}\n\n${right}`;
};

/** Раскладка расшифровки по полям формы. Входные разделы не мутируются. */
export const applyVoiceFill = (
  sections: DraftSection[],
  fieldValues: Record<string, string>,
): VoiceFillResult => {
  const entries: VoiceFillEntry[] = [];

  const nextSections = sections.map((section) => {
    const fieldId = section.fieldMeta?.id;
    if (!fieldId) return section;

    // Списочные поля хранят значение вариантом справочника: свободный текст
    // из речи в них не кладётся.
    if ((section.fieldMeta?.field_type ?? 'text') !== 'text') return section;

    const incoming = fieldValues[fieldId];
    if (typeof incoming !== 'string' || !incoming.trim()) return section;

    const previous = section.value;
    const mode: VoiceFillEntry['mode'] = previous.trim() ? 'append' : 'fill';
    const applied =
      mode === 'fill' ? incoming.trim() : appendText(previous, incoming);

    // Дописывание могло ничего не изменить — такой записи в журнале не место,
    // иначе поле подсветится без причины.
    if (applied === previous) return section;

    entries.push({
      sectionId: section.id,
      fieldId,
      label: section.label,
      previous,
      applied,
      mode,
    });

    return { ...section, value: applied };
  });

  return { sections: nextSections, entries };
};

/**
 * Вернуть одно поле к значению до применения.
 *
 * Откат выполняется, только если поле всё ещё содержит ровно то, что было
 * применено. Вызывающий код и так снимает запись при первой правке врача, но
 * полагаться на это здесь нельзя: ошибка на той стороне стоила бы врачу
 * потерянного текста, а проверка стоит одно сравнение.
 */
export const revertVoiceFill = (
  sections: DraftSection[],
  entry: VoiceFillEntry,
): DraftSection[] =>
  sections.map((section) =>
    section.id === entry.sectionId && section.value === entry.applied
      ? { ...section, value: entry.previous }
      : section,
  );

/** Вернуть к прежним значениям все перечисленные поля. */
export const revertAllVoiceFill = (
  sections: DraftSection[],
  entries: VoiceFillEntry[],
): DraftSection[] =>
  entries.reduce(
    (accumulated, entry) => revertVoiceFill(accumulated, entry),
    sections,
  );
