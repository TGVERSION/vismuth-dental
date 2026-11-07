'use client';

import { useState } from 'react';
import type { ClinicBranding } from '@/lib/questionnaire';

interface ConsentScreenProps {
  clinic: ClinicBranding;
  onAccept: () => void;
}

/**
 * Согласие на обработку персональных данных.
 *
 * По ТЗ (допущение Д1) согласие не собирается, и шаг по умолчанию выключен:
 * он показывается только когда сервер прислал `consent_required`. Шаг
 * заложен заранее, потому что встроить его в готовый поток потом заметно
 * дороже, чем предусмотреть сейчас.
 *
 * Текст ниже — рамка. Юридическую формулировку даёт клиника.
 */
export const ConsentScreen = ({ clinic, onAccept }: ConsentScreenProps) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="q-screen flex flex-col px-4 pt-8">
      <h1 className="text-2xl font-semibold">Перед началом</h1>

      <p className="mt-6 text-[var(--q-muted)]">
        Чтобы передать ваши ответы врачу, {clinic.name} обрабатывает указанные
        вами сведения о самочувствии. Ответы видит только врач, к которому вы
        записаны.
      </p>

      <label className="mt-8 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--q-brand)]"
        />
        <span className="text-sm">
          Я согласен на обработку персональных данных
        </span>
      </label>

      <div className="mt-auto pb-[calc(env(safe-area-inset-bottom)+16px)] pt-8">
        <button
          type="button"
          onClick={onAccept}
          disabled={!accepted}
          className="q-button w-full"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
};
