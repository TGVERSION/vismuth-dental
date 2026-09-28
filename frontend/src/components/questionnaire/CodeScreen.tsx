'use client';

import { useEffect, useState } from 'react';
import { logWarn } from '@/lib/logger';

interface CodeScreenProps {
  code: string;
  /** Уточняющие вопросы не задавались: ИИ был недоступен. */
  aiUnavailable: boolean;
  /** «Закрыть»: анкета завершена, продолжать после перезагрузки нечего. */
  onClose: () => void;
}

/**
 * Финальный экран: код, который пациент называет врачу.
 *
 * Обратной связи с пациентом нет, поэтому код показывается один раз и
 * крупно. Если он потеряется, врач найдёт анкету по имени и дате.
 */
export const CodeScreen = ({
  code,
  aiUnavailable,
  onClose,
}: CodeScreenProps) => {
  const [copied, setCopied] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (error) {
      // Буфер обмена может быть недоступен: нет разрешения или страница
      // открыта не по HTTPS. Код на экране виден — это не критично.
      logWarn('Анкета: копирование кода недоступно', error);
    }
  };

  const handleClose = () => {
    onClose();
    // Вкладку, открытую пациентом вручную, скрипт закрыть не может —
    // браузер это запрещает. Поэтому показываем прощальный экран, а не
    // делаем вид, что кнопка не сработала.
    window.close();
    setClosed(true);
  };

  if (closed) {
    return (
      <div className="q-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-lg font-medium">Анкета заполнена</p>
        <p className="mt-2 text-[var(--q-muted)]">
          Страницу можно закрыть. Ваш код: {code}
        </p>
      </div>
    );
  }

  return (
    <div className="q-screen flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
      <h1 className="text-[24px] font-bold">Готово!</h1>

      <p className="mt-3 text-[var(--q-muted)]">
        Назовите этот код врачу в начале приёма — так он сразу найдёт ваши
        ответы
      </p>

      <p className="mt-12 text-center text-6xl font-bold tracking-wide">
        {code}
      </p>

      <p aria-live="polite" className="sr-only">
        {copied ? 'Код скопирован' : ''}
      </p>

      {aiUnavailable ? (
        <p className="mt-8 text-center text-sm text-[var(--q-muted)]">
          Уточняющие вопросы сегодня не задавались — врач увидит ваши ответы как
          есть.
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-8">
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[52px] w-full rounded-xl bg-[var(--q-surface)] px-4 text-base font-medium"
        >
          {copied ? 'Код скопирован' : 'Скопировать код'}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)]"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};
