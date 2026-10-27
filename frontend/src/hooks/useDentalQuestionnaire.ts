'use client';

import { useCallback, useState } from 'react';
import type { PublicInvite, QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { mainApi } from '@/api/main-api';
import { dentalErrorKind, type DentalErrorKind } from '@/lib/dental-questionnaire';
import { logError } from '@/lib/logger';
import type { QuestionnaireBlock } from '@/lib/questionnaire';

const NETWORK_ERROR =
  'Не удалось отправить ответ. Проверьте интернет и попробуйте ещё раз.';
const REJECTED_ERROR = 'Ответ не принят. Проверьте отмеченное и попробуйте ещё раз.';

/**
 * Предел ожидания ответа. ИИ в стоматологической анкете не вызывается,
 * поэтому 200 секунд клиента общей анкеты здесь не нужны: пациент не должен
 * минутами смотреть на крутилку при зависшем соединении.
 */
const ANSWER_TIMEOUT_MS = 20000;

const BLOCKS: Partial<Record<DentalErrorKind, QuestionnaireBlock>> = {
  expired: 'invite_expired',
  not_found: 'invite_not_found',
  subscription: 'subscription_expired',
};

const inviteBlock = (invite: PublicInvite): QuestionnaireBlock | null => {
  if (!invite.blocked) return null;
  return invite.block_code === 'invite_expired' ? 'invite_expired' : 'subscription_expired';
};

/**
 * Состояние анкеты по персональной ссылке. Шаги ведёт backend: хук только
 * отправляет ответ и показывает следующий шаг.
 *
 * Ошибки:
 * - 410, 401/404, 503 subscription_expired — заглушка (ссылка устарела,
 *   ссылка не найдена, сервис недоступен);
 * - 409 и 400 — шаг перечитывается, как в общей анкете: ответ мог уже уйти
 *   (потерянный ответ сервера, вторая вкладка), и тогда пациент молча
 *   попадает на следующий шаг. Шаг прежний — текст под кнопкой;
 * - сеть, таймаут, 5xx — текст под кнопкой, черновик ответа сохраняется.
 */
export const useDentalQuestionnaire = (invite: PublicInvite, token: string) => {
  const [step, setStep] = useState<QuestionnaireStep | null>(invite.step);
  const [block, setBlock] = useState<QuestionnaireBlock | null>(inviteBlock(invite));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = invite.questionnaire_id;

  /** Заглушка для ошибки, если она есть. */
  const blockFor = useCallback((caught: unknown): boolean => {
    const next = BLOCKS[dentalErrorKind(caught)];
    if (next) setBlock(next);
    return next !== undefined;
  }, []);

  const reload = useCallback(
    async (answeredKey: string, kind: DentalErrorKind) => {
      try {
        const fresh = await mainApi.questionnaire.getStep(id, token);
        if (fresh.completed || fresh.step_key !== answeredKey) {
          setStep(fresh);
          return;
        }
        setError(kind === 'rejected' ? REJECTED_ERROR : NETWORK_ERROR);
      } catch (reloadError) {
        if (!blockFor(reloadError)) setError(NETWORK_ERROR);
      }
    },
    [id, token, blockFor],
  );

  const submit = useCallback(
    async (answer: QuestionnaireStepAnswer) => {
      setIsSubmitting(true);
      setError(null);
      try {
        setStep(
          await mainApi.questionnaire.answer(id, token, answer, {
            signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
          }),
        );
      } catch (submitError) {
        if (blockFor(submitError)) return;
        const kind = dentalErrorKind(submitError);
        if (kind === 'stale' || kind === 'rejected') {
          await reload(answer.step_key, kind);
          return;
        }
        logError('Анкета по ссылке: ошибка ответа', submitError);
        setError(NETWORK_ERROR);
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, token, blockFor, reload],
  );

  return { step, block, isSubmitting, error, submit };
};
