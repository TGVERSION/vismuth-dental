'use client';

import { useRef, useState } from 'react';

export function ClinicLogoUpload({
  onUpload,
  disabled = false,
}: {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="mt-2 space-y-2">
      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label="Файл логотипа"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled || busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (
            !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
            file.size > 5 * 1024 * 1024
          ) {
            setError('Выберите PNG, JPEG или WebP размером до 5 МБ');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await onUpload(file);
          } catch {
            setError('Не удалось загрузить логотип. Попробуйте ещё раз');
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className="vismuth-button vismuth-button--secondary"
      >
        {busy ? 'Загружается…' : 'Загрузить логотип'}
      </button>
      <p className="text-sm text-[var(--ui-color-alabaster-950)]">
        PNG, JPEG или WebP, до 5 МБ. Сохраняется автоматически.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
