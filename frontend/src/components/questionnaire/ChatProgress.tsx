'use client';

interface ChatProgressProps {
  /** Доля пройденного от 0 до 1. */
  value: number;
}

/**
 * Прогресс анкеты. Пациенту важно понимать, сколько ещё осталось: число
 * уточняющих вопросов заранее не известно, и без индикатора диалог выглядит
 * бесконечным — это прямой путь к брошенной анкете.
 */
export const ChatProgress = ({ value }: ChatProgressProps) => {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Прогресс анкеты"
      className="h-5 w-full overflow-hidden rounded-full bg-[var(--q-surface)]"
    >
      <div
        style={{ width: `${Math.max(percent, 12)}%` }}
        className="flex h-full items-center justify-center rounded-full bg-[var(--q-brand)] text-[length:var(--ui-font-size-11)] font-medium text-[var(--q-brand-contrast)] transition-[width] duration-300"
      >
        {percent}%
      </div>
    </div>
  );
};
