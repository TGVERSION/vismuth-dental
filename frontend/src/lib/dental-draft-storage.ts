import type { DentalDraft } from './dental-questionnaire';
import type { QuestionnaireStep } from '@/api';
import {
  draftForDentalStep,
  parseChecklist,
  parseGroups,
  scopedChecklistValues,
} from './dental-questionnaire';
import type { StorageLike } from './questionnaire-storage';

export const DENTAL_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const keyFor = (id: string) => `vismuth.dental.draft.${id}`;
interface SavedDraft {
  expires: number;
  steps: Record<
    string,
    { revision: number; draft: DentalDraft; baseline?: string }
  >;
}

/** Только исходные данные текущего шага: исправление другого шага их не меняет. */
export const dentalDraftBaseline = (step: QuestionnaireStep): string =>
  step.step_type === 'checklist'
    ? JSON.stringify([
        step.choices,
        step.dental?.answers.health_comments?.[step.step_key] ?? '',
        scopedChecklistValues(step, draftForDentalStep(step)),
        step.dental?.answers.health_answered
          ? parseChecklist(step)
              .map((item) => item.value)
              .filter((value) =>
                step.dental?.answers.health_answered?.includes(value),
              )
          : step.dental?.answers.health == null
            ? null
            : 'answered',
      ])
    : JSON.stringify(
        parseGroups(step).map((group) => [
          group.key,
          group.options,
          group.required,
          group.text?.show,
          step.dental?.answers.groups[group.key] ?? null,
        ]),
      );
const load = (
  storage: StorageLike | null,
  id: string,
  now: number,
): SavedDraft | null => {
  try {
    const raw = storage?.getItem(keyFor(id));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedDraft;
    if (
      !saved ||
      typeof saved.expires !== 'number' ||
      saved.expires <= now ||
      saved.expires > now + DENTAL_DRAFT_TTL_MS ||
      typeof saved.steps !== 'object' ||
      !saved.steps
    ) {
      storage?.removeItem(keyFor(id));
      return null;
    }
    return saved;
  } catch {
    try {
      storage?.removeItem(keyFor(id));
    } catch {}
    return null;
  }
};
export const readDentalDraft = (
  storage: StorageLike | null,
  id: string,
  step: string,
  revision: number,
  now = Date.now(),
  baseline?: string,
): DentalDraft | null => {
  const entry = load(storage, id, now)?.steps[step];
  if (
    !entry ||
    (entry.revision !== revision && (!baseline || entry.baseline !== baseline))
  )
    return null;
  const draft = entry.draft;
  if (
    !draft ||
    typeof draft.texts !== 'object' ||
    !draft.texts ||
    typeof draft.selections !== 'object' ||
    !draft.selections ||
    !Object.values(draft.texts).every(
      (x) => typeof x === 'string' && x.length <= 20000,
    ) ||
    !Object.values(draft.selections).every(
      (x) => Array.isArray(x) && x.every((v) => typeof v === 'string'),
    )
  )
    return null;
  return draft;
};
export const saveDentalDraft = (
  storage: StorageLike | null,
  id: string,
  step: string,
  revision: number,
  draft: DentalDraft,
  now = Date.now(),
  baseline?: string,
): void => {
  try {
    const saved = load(storage, id, now) ?? {
      expires: now + DENTAL_DRAFT_TTL_MS,
      steps: {},
    };
    saved.steps[step] = { revision, draft, baseline };
    storage?.setItem(keyFor(id), JSON.stringify(saved));
  } catch {
    /* Storage denied or full: the live form still works. */
  }
};
export const clearDentalDraft = (
  storage: StorageLike | null,
  id: string,
): void => {
  try {
    storage?.removeItem(keyFor(id));
  } catch {}
};
