'use client';
import { useCallback, useEffect, useState } from 'react';
import type { QuestionnaireStep } from '@/api';
import {
  draftForDentalStep,
  normalizeDentalDraft,
  type DentalDraft,
} from '@/lib/dental-questionnaire';
import {
  readDentalDraft,
  saveDentalDraft,
  dentalDraftBaseline,
} from '@/lib/dental-draft-storage';
import { browserStorage } from '@/lib/questionnaire-storage';

/** One current-step buffer; saved server answers remain the source for edits. */
export const useDentalDraft = (id: string, step: QuestionnaireStep) => {
  const [draft, setDraft] = useState<DentalDraft>(() =>
    draftForDentalStep(step),
  );
  const [restored, setRestored] = useState(false);
  const [owner, setOwner] = useState(step.step_key);
  // В чате редактор остаётся смонтированным, чтобы клавиатура не закрывалась.
  // Буфер переключается на новый вопрос до отрисовки его поля.
  if (owner !== step.step_key) {
    setOwner(step.step_key);
    setDraft(draftForDentalStep(step));
    setRestored(false);
  }
  const revision = step.dental?.revision ?? 0;
  const baseline = dentalDraftBaseline(step);
  useEffect(() => {
    const saved = readDentalDraft(
      browserStorage('session'),
      id,
      step.step_key,
      revision,
      Date.now(),
      baseline,
    );
    // Restore once after hydration; the keyed step component owns this buffer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft(normalizeDentalDraft(saved));
    setRestored(true);
  }, [id, step.step_key, revision, baseline]);
  const updateDraft = useCallback(
    (change: DentalDraft | ((current: DentalDraft) => DentalDraft)) => {
      setDraft((current) => {
        const next = typeof change === 'function' ? change(current) : change;
        saveDentalDraft(
          browserStorage('session'),
          id,
          step.step_key,
          revision,
          next,
          Date.now(),
          baseline,
        );
        return next;
      });
    },
    [id, step.step_key, revision, baseline],
  );
  return { draft, setDraft: updateDraft, restored };
};
