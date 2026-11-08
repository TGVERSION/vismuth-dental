'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { logWarn } from '@/lib/logger';
import { buildQrMatrix } from '@/lib/qr';
import {
  canCopyImage,
  copyImage,
  qrPngBlob,
  triggerDownload,
} from '@/lib/qr-browser';
import {
  isLocalOnlyUrl,
  type QuestionnaireLinkItem,
} from '@/lib/questionnaire-links';
import {
  INPUT_CLASS,
  LINK_BUTTON_CLASS,
} from '@/components/settings/clinics/fields';
import { QrCode } from './QrCode';

type CardStatus =
  | 'idle'
  | 'link_copied'
  | 'link_manual'
  | 'qr_copied'
  | 'qr_failed'
  | 'download_failed';

const STATUS_TEXT: Record<Exclude<CardStatus, 'idle'>, string> = {
  link_copied: 'Ссылка скопирована',
  link_manual: 'Скопируйте выделенную ссылку вручную',
  qr_copied: 'QR-код скопирован',
  qr_failed: 'Не удалось скопировать QR-код — скачайте его',
  download_failed: 'Не удалось скачать QR-код',
};

/** Сообщения об успехе гаснут сами, об ошибке — остаются до нового действия. */
const TRANSIENT: ReadonlySet<CardStatus> = new Set([
  'link_copied',
  'qr_copied',
]);
const TRANSIENT_MS = 2000;

const COPY_UNSUPPORTED = 'Браузер не умеет копировать картинки — скачайте QR';

const DISABLED_LINK_CLASS =
  'cursor-not-allowed text-sm text-[#5D8CF1] opacity-50';

interface LinkQrCardProps {
  item: QuestionnaireLinkItem;
  /** Печать листа с QR для кабинета. Нет — кнопки «Печать» нет. */
  onPrint?: (item: QuestionnaireLinkItem) => void;
}

/** Одна ссылка анкеты: адрес, QR и действия ТЗ. */
export const LinkQrCard = ({ item, onPrint }: LinkQrCardProps) => {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Адрес PNG для скачивания. Отзывается при следующем скачивании и при
  // закрытии окна, а не сразу после клика: в Firefox ранний отзыв обрывает
  // скачивание.
  const downloadRef = useRef<{ url: string | null; disposed: boolean }>({
    url: null,
    disposed: false,
  });
  const [status, setStatus] = useState<CardStatus>('idle');
  const [busy, setBusy] = useState(false);

  const matrix = useMemo(
    () => (item.qrText ? buildQrMatrix(item.qrText) : null),
    [item.qrText],
  );
  // Карточка рисуется только в окне после клика — серверного рендера нет,
  // поэтому `window` и `navigator` здесь доступны.
  const canCopy = useMemo(() => canCopyImage(), []);
  const localOnly = useMemo(
    () => isLocalOnlyUrl(item.url, window.location.hostname),
    [item.url],
  );

  useEffect(() => {
    const holder = downloadRef.current;
    // Сброс при монтировании обязателен: в StrictMode (dev) React монтирует
    // эффект, снимает и монтирует снова, и без сброса флаг `disposed` от
    // первого cleanup навсегда отключил бы скачивание.
    holder.disposed = false;
    return () => {
      holder.disposed = true;
      if (holder.url) URL.revokeObjectURL(holder.url);
      holder.url = null;
    };
  }, []);

  useEffect(() => {
    if (!TRANSIENT.has(status)) return;

    const timer = setTimeout(() => setStatus('idle'), TRANSIENT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const handleCopyLink = () => {
    copyText(item.url)
      .then(() => setStatus('link_copied'))
      .catch(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        setStatus('link_manual');
      });
  };

  const handleDownload = () => {
    if (!matrix || busy) return;

    setBusy(true);
    qrPngBlob(matrix)
      .then((blob) => {
        const holder = downloadRef.current;
        if (holder.disposed) return;

        if (holder.url) URL.revokeObjectURL(holder.url);
        holder.url = URL.createObjectURL(blob);
        triggerDownload(holder.url, item.fileName);
        setStatus('idle');
      })
      .catch((error: unknown) => {
        logWarn('Ссылки анкеты: не удалось скачать QR', error);
        setStatus('download_failed');
      })
      .finally(() => setBusy(false));
  };

  const handleCopyQr = () => {
    if (!matrix || busy) return;

    setBusy(true);
    // PNG строится внутри записи в буфер: Safari требует вызвать запись
    // синхронно в обработчике клика (см. copyImage).
    copyImage(qrPngBlob(matrix))
      .then(() => setStatus('qr_copied'))
      .catch((error: unknown) => {
        logWarn('Ссылки анкеты: не удалось скопировать QR', error);
        setStatus('qr_failed');
      })
      .finally(() => setBusy(false));
  };

  const message = status === 'idle' ? '' : STATUS_TEXT[status];
  const messageColor =
    status === 'qr_failed' || status === 'download_failed'
      ? 'text-[#D91528]'
      : status === 'link_manual'
        ? 'text-[#6C757D]'
        : 'text-[#22A06B]';

  return (
    <section
      aria-labelledby={titleId}
      className="flex gap-5 rounded-2xl bg-[#F3F4F8] p-4"
    >
      {matrix ? (
        <QrCode
          matrix={matrix}
          label={`QR-код: ${item.title}`}
          className="h-36 w-36 shrink-0 rounded-lg"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 id={titleId} className="text-lg font-medium text-[#202020]">
          {item.title}
        </h3>
        <p className="text-sm text-[#6C757D]">{item.description}</p>

        <input
          ref={inputRef}
          type="text"
          readOnly
          value={item.url}
          aria-label={`Адрес: ${item.title}`}
          onFocus={(event) => event.currentTarget.select()}
          className={`${INPUT_CLASS} bg-white`}
        />

        {localOnly ? (
          <p className="text-xs text-[#D91528]">
            Ссылка ведёт на локальный адрес — пациент не откроет её с телефона.
            Сообщите администратору: не задан публичный адрес сервиса.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className={LINK_BUTTON_CLASS}
          >
            Скопировать ссылку
          </button>

          {matrix ? (
            <>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className={LINK_BUTTON_CLASS}
              >
                Скачать QR
              </button>

              {canCopy ? (
                <button
                  type="button"
                  onClick={handleCopyQr}
                  disabled={busy}
                  className={LINK_BUTTON_CLASS}
                >
                  Скопировать QR
                </button>
              ) : (
                // `aria-disabled`, а не `disabled`: у отключённой кнопки
                // подсказка `title` видна не во всех браузерах.
                <span title={COPY_UNSUPPORTED}>
                  <button
                    type="button"
                    aria-disabled="true"
                    className={DISABLED_LINK_CLASS}
                  >
                    Скопировать QR
                    <span className="sr-only"> — {COPY_UNSUPPORTED}</span>
                  </button>
                </span>
              )}

              {onPrint ? (
                <button
                  type="button"
                  onClick={() => onPrint(item)}
                  className={LINK_BUTTON_CLASS}
                >
                  Печать
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <p role="status" className={`min-h-4 text-xs ${messageColor}`}>
          {message}
        </p>
      </div>
    </section>
  );
};
