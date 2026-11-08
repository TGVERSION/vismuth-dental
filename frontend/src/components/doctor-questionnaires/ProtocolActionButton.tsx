'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  protocolHref,
  useCreateProtocolFromQuestionnaire,
} from '@/hooks/useCreateProtocolFromQuestionnaire';
import { useProtocolStructuresStore } from '@/store/protocolStructuresStore';

const BUTTON_CLASS =
  'flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#DCE7FF] px-6 text-[#5D8CF1] transition-colors hover:bg-[#F0F5FF] disabled:cursor-not-allowed disabled:opacity-60';

interface ProtocolActionButtonProps {
  questionnaireId: string;
  /** Уже созданный из анкеты протокол. */
  protocolId: string | null;
}

/**
 * «Открыть протокол», если он уже создан, иначе «Создать протокол».
 *
 * Для создания нужна структура протокола. Одна — протокол создаётся сразу,
 * несколько — меню выбора над кнопкой.
 */
export const ProtocolActionButton = ({
  questionnaireId,
  protocolId,
}: ProtocolActionButtonProps) => {
  const { create, isCreating } = useCreateProtocolFromQuestionnaire();
  const structures = useProtocolStructuresStore((state) => state.structures);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const menuId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMenuOpen]);

  if (protocolId) {
    return (
      <Link href={protocolHref(protocolId)} className={BUTTON_CLASS}>
        Открыть протокол
      </Link>
    );
  }

  const isBusy = isCreating || isPreparing;

  const handleClick = async () => {
    if (isBusy) return;
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }

    // `fetchStructures` ошибку не бросает, а пишет в стор — поэтому состояние
    // читается из стора после загрузки.
    let state = useProtocolStructuresStore.getState();
    if (state.structures.length === 0 || state.error) {
      setIsPreparing(true);
      await state.fetchStructures();
      if (!mountedRef.current) return;
      setIsPreparing(false);
      state = useProtocolStructuresStore.getState();
    }

    if (state.error) {
      toast.error('Не удалось загрузить структуры протокола');
      return;
    }
    if (state.structures.length === 0) {
      toast.error('Нет доступных структур протокола');
      return;
    }
    if (state.structures.length === 1) {
      void create(questionnaireId, state.structures[0].id);
      return;
    }
    setIsMenuOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? menuId : undefined}
        className={`${BUTTON_CLASS} cursor-pointer`}
      >
        {isBusy && (
          <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#5D8CF1]" />
        )}
        Создать протокол
      </button>

      {/* Меню после кнопки: над ней его ставит `bottom-full`, а порядок в DOM
          даёт клавиатуре дойти до структур по Tab сразу от кнопки. */}
      {isMenuOpen && (
        <ul
          id={menuId}
          aria-label="Структура протокола"
          className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-60 overflow-y-auto rounded-xl bg-white p-2 shadow-custom"
        >
          {structures.map((structure) => (
            <li key={structure.id}>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  void create(questionnaireId, structure.id);
                }}
                className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[#F0F5FF]"
              >
                <span className="block font-medium text-gray-800">
                  {structure.structure_name}
                </span>
                {structure.description && (
                  <span className="mt-0.5 line-clamp-1 block text-xs text-gray-500">
                    {structure.description}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
