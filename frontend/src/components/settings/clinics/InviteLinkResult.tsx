'use client';

import { useRef, useState } from 'react';
import type { ClinicInvitationCreated } from '@/api';
import { copyText } from '@/lib/clipboard';
import { fieldFillClass } from '@/lib/field-fill';
import { INPUT_CLASS, LINK_BUTTON_CLASS } from './fields';

interface InviteLinkResultProps {
  invitation: ClinicInvitationCreated;
}

/**
 * Итог приглашения. Если письмо не ушло, backend один раз отдаёт ссылку —
 * её показываем для ручной передачи. Ссылка содержит одноразовый токен:
 * живёт только в state, не логируется и не сохраняется.
 */
export const InviteLinkResult = ({ invitation }: InviteLinkResultProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>(
    'idle',
  );

  if (invitation.email_sent) {
    return (
      <p role="status" className="text-sm text-[#22A06B]">
        Приглашение отправлено на {invitation.email}
      </p>
    );
  }

  const copy = async () => {
    try {
      await copyText(invitation.invite_url);
      setCopyState('copied');
    } catch {
      inputRef.current?.select();
      setCopyState('manual');
    }
  };

  return (
    <div role="status">
      <p className="text-sm text-[#202020]">
        Письмо на {invitation.email} не отправлено. Передайте ссылку сотруднику
        сами — она действует 7 дней.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={invitation.invite_url}
          aria-label="Ссылка приглашения"
          onFocus={(event) => event.currentTarget.select()}
          className={`${INPUT_CLASS} ${fieldFillClass(invitation.invite_url)}`}
        />
        <button type="button" onClick={copy} className={LINK_BUTTON_CLASS}>
          Скопировать
        </button>
      </div>
      {copyState === 'copied' && (
        <p className="mt-1 text-xs text-[#22A06B]">Ссылка скопирована</p>
      )}
      {copyState === 'manual' && (
        <p className="mt-1 text-xs text-[#6C757D]">
          Скопируйте выделенную ссылку вручную
        </p>
      )}
    </div>
  );
};
