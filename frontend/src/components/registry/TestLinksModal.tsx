'use client';

import { useRef, useState } from 'react';
import { mainApi } from '@/api';
import {
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from '@/components/settings/clinics/ModalShell';
import { copyText } from '@/lib/clipboard';

interface TestLinksModalProps {
  clinicId: string;
  clinicName: string;
  onClose: () => void;
  onCreated: () => void;
}

export const TestLinksModal = ({
  clinicId,
  clinicName,
  onClose,
  onCreated,
}: TestLinksModalProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const pending = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const linkText = links.join('\n');

  const create = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsCreating(true);
    setError('');
    try {
      const created =
        await mainApi.clinicQuestionnaires.createTestLinks(clinicId);
      setLinks(created.map((item) => item.url));
      onCreated();
    } catch {
      setError('Не удалось создать тестовые ссылки. Попробуйте ещё раз.');
    } finally {
      pending.current = false;
      setIsCreating(false);
    }
  };

  const copy = async () => {
    try {
      await copyText(linkText);
      setCopyStatus('Ссылки скопированы');
    } catch {
      field.current?.focus();
      field.current?.select();
      setCopyStatus('Скопируйте выделенные ссылки вручную');
    }
  };

  return (
    <ModalShell
      title={links.length ? 'Тестовые ссылки готовы' : 'Тестовые ссылки'}
      onClose={onClose}
      closeDisabled={isCreating}
      dismissDisabled={links.length > 0}
    >
      <div className="flex flex-col gap-4">
        {links.length ? (
          <>
            <textarea
              ref={field}
              aria-label="Тестовые ссылки"
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              rows={5}
              readOnly
              wrap="off"
              value={linkText}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={copy}
            >
              Скопировать все ссылки
            </button>
            {copyStatus && (
              <p role="status" className="text-sm">
                {copyStatus}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm">
              Будут созданы пять тестовых анкет для клиники «{clinicName}».
            </p>
            {error && (
              <p
                role="alert"
                className="text-sm text-[var(--ui-color-red-600)]"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={isCreating}
              onClick={create}
            >
              {isCreating ? 'Создаём…' : 'Создать 5 ссылок'}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
};
