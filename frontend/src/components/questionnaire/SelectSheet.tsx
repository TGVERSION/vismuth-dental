'use client';

import { useState } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { PickerShell } from './PickerShell';

export interface SelectSheetOption {
  value: string;
  label: string;
}

interface SelectSheetProps {
  title: string;
  options: SelectSheetOption[];
  value: string;
  onClose: () => void;
  onApply: (value: string) => void;
}

/**
 * Выбор одного варианта из списка.
 *
 * На телефоне это шторка снизу: вариант отмечается радиокнопкой и
 * применяется по «Готово», поэтому закрытие крестиком или по фону не меняет
 * фильтр случайным касанием.
 *
 * На десктопе это обычный выпадающий список: нажатие сразу применяет выбор
 * и закрывает список — так ведут себя привычные селекты, и отдельная кнопка
 * подтверждения там только мешает.
 */
export const SelectSheet = ({
  title,
  options,
  value,
  onClose,
  onApply,
}: SelectSheetProps) => {
  const isDesktop = useIsDesktop();
  // Компонент монтируется только когда список открыт, поэтому черновик
  // начинается с текущего значения сам — синхронизировать его эффектом
  // не нужно.
  const [draft, setDraft] = useState(value);

  const choose = (next: string) => {
    if (isDesktop) {
      onApply(next);
      return;
    }

    setDraft(next);
  };

  return (
    <PickerShell
      title={title}
      onClose={onClose}
      footer={
        isDesktop ? undefined : (
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="min-h-[52px] w-full rounded-xl bg-[var(--q-brand)] px-4 text-base font-medium text-[var(--q-brand-contrast)]"
          >
            Готово
          </button>
        )
      }
    >
      <ul role="radiogroup" aria-label={title} className="pb-2">
        {options.map((option) => {
          const selected = option.value === draft;

          return (
            <li key={option.value}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(option.value)}
                className={
                  isDesktop
                    ? `flex w-full items-center px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                        selected ? 'bg-gray-50' : ''
                      }`
                    : 'flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left'
                }
              >
                <span>{option.label}</span>

                {isDesktop ? null : (
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected
                        ? 'border-[var(--q-brand)]'
                        : 'border-[var(--q-muted)]'
                    }`}
                  >
                    {selected ? (
                      <span className="h-3 w-3 rounded-full bg-[var(--q-brand)]" />
                    ) : null}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </PickerShell>
  );
};
