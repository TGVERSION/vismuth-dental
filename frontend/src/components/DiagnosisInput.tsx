/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMkb10Diagnoses } from '@/hooks/useMkb10Diagnoses';
import { CandidatesItem, mainApi, Mkb10Item } from '@/api';
import type { MkbEventType } from '@/api';
import { useHelpersStore } from '@/store/helpersStore';
import { ML_MAIN_DIAGNOSIS_FIELD_NAME } from '@/lib/protocol-fields';
import { logError } from '@/lib/logger';

interface DiagnosisInputProps {
  id: number;
  label: string;
  value: string;
  isActive?: boolean;
  onValueChange: (id: number, newValue: string) => void;
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export const DiagnosisInput: React.FC<DiagnosisInputProps> = ({
  id,
  label,
  value,
  onValueChange,
  isActive,
}) => {
  const { mkbEnabled, autocompleteProvider } = useHelpersStore();
  const isMkbHelperEnabled = mkbEnabled;
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [aiCandidates, setAiCandidates] = useState<CandidatesItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const prevActive = useRef(isActive);

  const editableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Отложенный обработчик blur читает значение через ref: к моменту его
  // срабатывания клик по варианту списка уже мог обновить value, а замыкание
  // держало бы прежнее и откатывало только что выбранный диагноз.
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!editableRef.current) return;
    const currentText = editableRef.current.textContent ?? '';
    if (currentText !== value) {
      editableRef.current.textContent = value;
    }
  }, [value]);

  useEffect(() => {
    if (isActive && prevActive.current === false) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
    prevActive.current = isActive;
  }, [isActive]);

  const { diagnoses, loading, hasMore, sentinelRef } = useMkb10Diagnoses({
    searchValue,
    isOpen: isOpen,
  });

  const updateDropdownPosition = useCallback(() => {
    if (isOpen && editableRef.current) {
      const rect = editableRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !editableRef.current) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      updateDropdownPosition();
    });
    resizeObserverRef.current.observe(editableRef.current);

    updateDropdownPosition();

    const throttledUpdate = throttle(updateDropdownPosition, 16);
    window.addEventListener('scroll', throttledUpdate, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', throttledUpdate);

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener('scroll', throttledUpdate, {
        capture: true,
      } as any);
      window.removeEventListener('resize', throttledUpdate);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) {
      setDropdownPos(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && editableRef.current) {
      editableRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setAiCandidates([]);
      setAiLoading(false);
    }
  }, [isOpen]);

  const throttle = <T extends (...args: any[]) => void>(
    func: T,
    delay: number,
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  };

  const sendMlStatus = useCallback(
    (
      eventType: MkbEventType,
      selectedText: string = '',
      countSugest: number = -1,
    ) => {
      if (!isMkbHelperEnabled) return;

      mainApi.ml_handlers
        .mlAutocompleteStatus({
          field_name: ML_MAIN_DIAGNOSIS_FIELD_NAME,
          description: value.length === 0 ? ' ' : value,
          selected_text: selectedText,
          n_candidates: countSugest,
          event_type: eventType,
          type_autocomplete:
            autocompleteProvider !== 'off' ? autocompleteProvider : undefined,
        })
        .catch((error) => logError('Failed to send ML status:', error));
    },
    [value, isMkbHelperEnabled, autocompleteProvider],
  );

  const fetchAiCandidates = useCallback(
    async (text: string) => {
      if (!isMkbHelperEnabled) {
        setAiCandidates([]);
        return;
      }

      if (!text.trim()) {
        setAiCandidates([]);
        return;
      }

      setAiLoading(true);
      try {
        const res = await mainApi.ml_handlers.mlMkbCode({
          field_name: ML_MAIN_DIAGNOSIS_FIELD_NAME,
          description: text,
          n_candidates: 3,
          use_llm: true,
        });
        setAiCandidates((res.candidates as unknown as CandidatesItem[]) || []);
      } catch (error) {
        logError('Failed to fetch AI candidates:', error);
        setAiCandidates([]);
      } finally {
        setAiLoading(false);
      }
    },
    [isMkbHelperEnabled],
  );

  const debouncedSearchValue = useDebounce(searchValue, 300);

  const handleSelect = (diagnosis: Mkb10Item) => {
    const fullDiagnosis = `${diagnosis.code} – ${diagnosis.name}`;
    onValueChange(id, fullDiagnosis);
    setIsOpen(false);
    setSearchValue('');
    if (editableRef.current) {
      editableRef.current.textContent = fullDiagnosis;
    }
    sendMlStatus('suggestion_selected', fullDiagnosis, diagnoses.length);
  };
  const handleAiSelect = (candidate: CandidatesItem) => {
    const fullDiagnosis = `${candidate.name}`;
    onValueChange(id, fullDiagnosis);
    setIsOpen(false);
    setSearchValue('');
    if (editableRef.current) {
      editableRef.current.textContent = fullDiagnosis;
    }
    sendMlStatus('suggestion_selected', fullDiagnosis, aiCandidates.length);
  };

  const handleInput = () => {
    if (!editableRef.current) return;

    const plainText = editableRef.current.textContent ?? '';
    setSearchValue(plainText);

    if (!isOpen) setIsOpen(true);
    if (plainText.length === 0) setAiCandidates([]);
  };

  const handleFocus = () => {
    if (!isOpen) setIsOpen(true);
    sendMlStatus('form_click');
  };

  // Диагноз задаётся только выбором из справочника МКБ-10: набранный текст —
  // это поисковый запрос, а не значение поля. Поэтому при уходе из поля текст,
  // не соответствующий выбранному диагнозу, откатывается. Иначе врач видел бы
  // на экране свой текст и надпись «Все изменения сохранены», хотя в протокол
  // не попало ничего.
  //
  // Задержка нужна, чтобы клик по варианту в выпадающем списке успел
  // отработать: к моменту таймера handleSelect уже проставил value.
  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);

    blurTimerRef.current = setTimeout(() => {
      setIsOpen(false);

      const editable = editableRef.current;
      if (!editable) return;

      const current = valueRef.current;
      const typed = (editable.textContent ?? '').trim();

      if (typed === '') {
        if (current !== '') onValueChange(id, '');
        setSearchValue('');
        return;
      }

      if (typed !== current.trim()) {
        editable.textContent = current;
        setSearchValue('');
      }
    }, 200);
  };

  useEffect(() => {
    if (isOpen && debouncedSearchValue.trim()) {
      fetchAiCandidates(debouncedSearchValue);
    }
  }, [debouncedSearchValue, isOpen, fetchAiCandidates]);

  const shouldResetSearch = useRef(true);
  useEffect(() => {
    shouldResetSearch.current = true;
  }, [value]);

  const handleOpenWithReset = () => {
    if (shouldResetSearch.current && value.trim()) {
      if (/^[A-Z0-9]+\.?\d* – .+/.test(value)) {
        setSearchValue('');
      } else {
        setSearchValue(value);
      }
      shouldResetSearch.current = false;
    }
    setIsOpen(true);
  };

  // Набран текст, но диагноз из справочника ещё не выбран.
  const hasUnselectedText =
    isOpen && searchValue.trim() !== '' && searchValue.trim() !== value.trim();

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos?.top ?? 0,
        left: dropdownPos?.left ?? 0,
        zIndex: 'var(--ui-z-popover)',
      }}
      className="p-[var(--ui-space-6)] max-w-103.5 bg-[var(--ui-color-alabaster-50)] rounded-[var(--ui-radius-lg)] shadow-[var(--ui-shadow)] border-0 max-h-80 overflow-y-auto custom-scrollbar"
    >
      {isMkbHelperEnabled && (
        <>
          <h4 className="text-[var(--ui-color-alabaster-950)] text-[length:var(--ui-font-size-12)] font-medium">
            Наиболее подходящие диагнозы
          </h4>
          <div className="pt-[var(--ui-space-6)] pb-3 border-b mb-3 border-[var(--ui-color-slate-200)]">
            {aiLoading ? (
              <div className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-gray-400 text-sm">
                Загрузка рекомендаций...
              </div>
            ) : aiCandidates.length > 0 ? (
              aiCandidates.map((cand) => {
                const percent = Math.round(cand.similarity * 100);
                return (
                  <div
                    key={`ai-${cand.code}`}
                    onClick={() => handleAiSelect(cand)}
                    className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] flex flex-row gap-[var(--ui-space-10)] items-center cursor-pointer rounded-md transition-colors hover:bg-[var(--ui-color-blue-100)] text-[var(--ui-color-alabaster-dark-800)]"
                  >
                    <div className="text-sm text-[var(--ui-color-blue-600)] text-right">
                      {percent}%
                    </div>
                    <div className="text-sm flex-1">{cand.name}</div>
                  </div>
                );
              })
            ) : (
              <div className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-gray-400 text-sm">
                Опишите диагноз система поможет его подобрать
              </div>
            )}
          </div>
        </>
      )}

      <h4 className="text-[var(--ui-color-alabaster-950)] text-[length:var(--ui-font-size-12)] font-medium">
        Все диагнозы
      </h4>
      <div className="py-[var(--ui-space-6)]">
        {diagnoses.length === 0 && !loading && searchValue.trim() !== '' && (
          <div className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-gray-500 text-sm">
            Диагнозы не найдены
          </div>
        )}

        {diagnoses.length === 0 && !loading && searchValue.trim() === '' && (
          <div className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-gray-400 text-sm">
            Начните вводить код или название...
          </div>
        )}

        {diagnoses.map((diagnosis) => {
          const selectedCode = value.split(' – ')[0]?.trim();
          const isSelected = selectedCode === diagnosis.code;

          return (
            <div
              key={diagnosis.code}
              onClick={() => handleSelect(diagnosis)}
              className={`px-[var(--ui-space-10)] py-[var(--ui-space-6)] cursor-pointer rounded-md transition-colors ${
                isSelected
                  ? 'bg-[var(--ui-color-blue-100)] text-[var(--ui-color-alabaster-dark-800)]'
                  : 'hover:bg-[var(--ui-color-blue-100)] text-[var(--ui-color-alabaster-dark-800)]'
              }`}
            >
              <div className="text-sm">
                {diagnosis.code} – {diagnosis.name}
              </div>
            </div>
          );
        })}

        {loading && diagnoses.length === 0 && (
          <div className="px-[var(--ui-space-10)] py-[var(--ui-space-6)] text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--ui-color-blue-600)]"></div>
          </div>
        )}

        {!loading && hasMore && diagnoses.length > 0 && (
          <div
            ref={sentinelRef}
            className="h-10 flex items-center justify-center"
          >
            <div className="text-xs text-gray-400">Загрузка...</div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col mb-6 relative">
      <div className="flex-grow relative">
        <div className="flex items-center ml-7 gap-3">
          <div className="flex-shrink-0">
            <div className="text-[length:var(--ui-font-size-31)] font-medium bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
              <p className={`${animate ? 'animate-scale-pulse' : ''}`}>
                {label}
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onClick={handleOpenWithReset}
            data-placeholder="Введите код или название диагноза..."
            className="ml-7 text-[var(--ui-color-alabaster-dark-800)] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full bg-transparent placeholder-gray-400 py-2 min-h-5.5 whitespace-pre-wrap break-words"
            style={{ wordBreak: 'break-word' }}
            role="textbox"
            aria-multiline="true"
          />

          {hasUnselectedText && (
            <p className="ml-7 mt-[var(--ui-space-2)] text-[length:var(--ui-font-size-13)] text-[var(--ui-color-yellow-600)]">
              Диагноз не выбран — выберите вариант из списка
            </p>
          )}

          {isOpen &&
            dropdownPos &&
            createPortal(dropdownContent, document.body)}
        </div>
      </div>
    </div>
  );
};
