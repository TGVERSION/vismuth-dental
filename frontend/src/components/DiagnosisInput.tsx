'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMkb10Diagnoses } from '@/hooks/useMkb10Diagnoses';
import { CandidatesItem, mainApi, Mkb10Item } from '@/api';
import { useHelpersStore } from '@/store/helpersStore';

interface DiagnosisInputProps {
  id: number;
  label: string;
  value: string;
  isActive?: boolean;
  onValueChange: (id: number, newValue: string) => void;
}

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
  const [localDraft, setLocalDraft] = useState<string | null>(null);
  useEffect(() => {
    setLocalDraft(null);
  }, [value]);
  const isValidDiagnosisFormat = (text: string): boolean => {
    if (!text) return false;
    return /^[A-Z0-9]+\.?\d*\s*–\s+.+/.test(text.trim());
  };
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && prevActive.current === false) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
    prevActive.current = isActive;
  }, [isActive]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { diagnoses, loading, hasMore, sentinelRef } = useMkb10Diagnoses({
    searchValue,
    isOpen: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    } else {
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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setAiCandidates([]);
      setAiLoading(false);
    }
  }, [isOpen]);

  const sendMlStatus = useCallback(
    (
      eventType: string,
      selectedText: string = '',
      countSugest: number = -1,
    ) => {
      if (!isMkbHelperEnabled) return;

      mainApi.ml_handlers
        .mlAutocompleteStatus({
          field_name: 'main_diagnosis',
          description: value.length === 0 ? ' ' : value,
          selected_text: selectedText,
          n_candidates: countSugest,
          event_type: eventType,
          type_autocomplete:
            autocompleteProvider !== 'off' ? autocompleteProvider : undefined,
        })
        .catch((error) => console.error('Failed to send ML status:', error));
    },
    [value, isMkbHelperEnabled],
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
          field_name: 'main_diagnosis',
          description: text,
          n_candidates: 3,
          use_llm: true,
        });
        setAiCandidates(res.candidates || []);
      } catch (error) {
        console.error('Failed to fetch AI candidates:', error);
        setAiCandidates([]);
      } finally {
        setAiLoading(false);
      }
    },
    [isMkbHelperEnabled],
  );

  const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
      const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
  };

  const debouncedSearchValue = useDebounce(searchValue, 300);

  const handleSelect = (diagnosis: Mkb10Item) => {
    const fullDiagnosis = `${diagnosis.code} – ${diagnosis.name}`;
    onValueChange(id, fullDiagnosis);
    setLocalDraft(null);
    setIsOpen(false);
    setSearchValue('');
    sendMlStatus('suggestion_selected', fullDiagnosis, diagnoses.length);
  };
  const handleAiSelect = (candidate: CandidatesItem) => {
    const fullDiagnosis = `${candidate.name}`;
    onValueChange(id, fullDiagnosis);
    setLocalDraft(null);
    setIsOpen(false);
    setSearchValue('');
    sendMlStatus('suggestion_selected', fullDiagnosis, aiCandidates.length);
  };

  const handleBlur = () => {
    if (localDraft !== null) {
      if (localDraft.trim() === '') {
        onValueChange(id, '');
        setLocalDraft(null);
      } else if (!isValidDiagnosisFormat(localDraft)) {
        setLocalDraft(null);
      }
    }
    setTimeout(() => setIsOpen(false), 200);
  };
  useEffect(() => {
    if (isOpen && debouncedSearchValue.trim()) {
      fetchAiCandidates(debouncedSearchValue);
    }
  }, [debouncedSearchValue, isOpen, fetchAiCandidates]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalDraft(newValue);
    setSearchValue(newValue);
    if (!isOpen) setIsOpen(true);
    if (newValue.length === 0) setAiCandidates([]);
  };

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

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos?.top ?? 0,
        left: dropdownPos?.left ?? 0,
        zIndex: 9999,
      }}
      className="p-1.5 max-w-103.5 bg-white rounded-lg shadow-lg border-0 max-h-80 overflow-y-auto custom-scrollbar"
    >
      {isMkbHelperEnabled && (
        <>
          <h4 className="text-[#6C757D] text-[12px] font-medium">
            Наиболее подходящие диагнозы
          </h4>
          <div className="pt-1.5 pb-3 border-b mb-3 border-[#E9ECEF]">
            {aiLoading ? (
              <div className="px-2.5 py-1.5 text-gray-400 text-sm">
                Загрузка рекомендаций...
              </div>
            ) : aiCandidates.length > 0 ? (
              aiCandidates.map((cand) => {
                const percent = Math.round(cand.similarity * 100);
                return (
                  <div
                    key={`ai-${cand.code}`}
                    onClick={() => handleAiSelect(cand)}
                    className="px-2.5 py-1.5 flex flex-row gap-2.5 items-center cursor-pointer rounded-md transition-colors hover:bg-[#e6efff] text-[#202020]"
                  >
                    <div className="text-sm text-[#5D8CF1] text-right">
                      {percent}%
                    </div>
                    <div className="text-sm flex-1">{cand.name}</div>
                  </div>
                );
              })
            ) : (
              <div className="px-2.5 py-1.5 text-gray-400 text-sm">
                Опишите диагноз система поможет его подобрать
              </div>
            )}
          </div>
        </>
      )}

      <h4 className="text-[#6C757D] text-[12px] font-medium">Все диагнозы</h4>
      <div className="py-1.5">
        {diagnoses.length === 0 && !loading && searchValue.trim() !== '' && (
          <div className="px-2.5 py-1.5 text-gray-500 text-sm">
            Диагнозы не найдены
          </div>
        )}

        {diagnoses.length === 0 && !loading && searchValue.trim() === '' && (
          <div className="px-2.5 py-1.5 text-gray-400 text-sm">
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
              className={`px-2.5 py-1.5 cursor-pointer rounded-md transition-colors ${
                isSelected
                  ? 'bg-[#e6efff] text-[#202020]'
                  : 'hover:bg-[#e6efff] text-[#202020]'
              }`}
            >
              <div className="text-sm">
                {diagnosis.code} – {diagnosis.name}
              </div>
            </div>
          );
        })}

        {loading && diagnoses.length === 0 && (
          <div className="px-2.5 py-1.5 text-center">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#5D8CF1]"></div>
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
            <div className="text-[30px] font-medium leading-[140%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
              <p className={`${animate ? 'animate-scale-pulse' : ''}`}>
                {label}
              </p>
            </div>
          </div>
        </div>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localDraft !== null ? localDraft : value}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onClick={() => {
              sendMlStatus('form_click');
              handleOpenWithReset();
            }}
            onFocus={handleOpenWithReset}
            placeholder="Введите код или название диагноза..."
            className="ml-7 text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full bg-transparent placeholder-gray-400 leading-[140%] py-2"
          />
          {isOpen &&
            dropdownPos &&
            createPortal(dropdownContent, document.body)}
        </div>
      </div>
    </div>
  );
};
