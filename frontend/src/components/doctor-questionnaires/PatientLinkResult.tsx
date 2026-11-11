'use client';

import { useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';

export function PatientLinkResult({
  url,
  label = 'Ссылка для пациента',
}: {
  url: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');

  const copy = async () => {
    try {
      await copyText(url);
      setStatus('copied');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setStatus('manual');
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <input
        ref={inputRef}
        value={url}
        readOnly
        aria-label={label}
        onFocus={(event) => event.target.select()}
        className="vismuth-input min-w-0 bg-white!"
      />
      <button
        type="button"
        className="vismuth-button vismuth-button--secondary"
        data-size="s"
        onClick={() => void copy()}
      >
        {status === 'copied' ? 'Скопировано' : 'Копировать'}
      </button>
      <p
        role="status"
        className={status === 'manual' ? 'text-sm sm:col-span-2' : 'sr-only'}
      >
        {status === 'manual' && 'Скопируйте выделенную ссылку вручную'}
        {status === 'copied' && 'Ссылка скопирована'}
      </p>
    </div>
  );
}
