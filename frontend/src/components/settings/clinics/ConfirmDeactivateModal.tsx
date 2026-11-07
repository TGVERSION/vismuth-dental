'use client';

import { useState } from 'react';
import {
  DANGER_BUTTON_CLASS,
  ModalShell,
  SECONDARY_BUTTON_CLASS,
} from './ModalShell';

interface ConfirmDeactivateModalProps {
  name: string;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}

export const ConfirmDeactivateModal = ({
  name,
  onConfirm,
  onClose,
}: ConfirmDeactivateModalProps) => {
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    const ok = await onConfirm();
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Удалить сотрудника?"
      onClose={onClose}
      closeDisabled={submitting}
    >
      <p className="mb-[var(--ui-space-32)] text-[length:var(--ui-font-size-18)] text-[var(--ui-color-alabaster-950)]">
        {name} больше не сможет войти в сервис, место в лимите врачей
        освободится
      </p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={submitting}
          className={DANGER_BUTTON_CLASS}
        >
          {submitting ? 'Удаляем…' : 'Удалить'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={SECONDARY_BUTTON_CLASS}
        >
          Оставить
        </button>
      </div>
    </ModalShell>
  );
};
