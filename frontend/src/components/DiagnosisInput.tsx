'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMkb10Diagnoses } from '@/hooks/useMkb10Diagnoses';
import { CandidatesItem, mainApi, Mkb10Item } from '@/api';

interface DiagnosisInputProps {
  id: number;
  label: string;
  value: string;
  onValueChange: (id: number, newValue: string) => void;
}

export const DiagnosisInput: React.FC<DiagnosisInputProps> = ({
  id,
  label,
  value,
  onValueChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [aiCandidates, setAiCandidates] = useState<CandidatesItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { diagnoses, loading, hasMore, sentinelRef } = useMkb10Diagnoses({
    searchValue,
    isOpen,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
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

  // //  Отправка статуса в ML
  const sendMlStatus = useCallback(
    (
      eventType: string,
      selectedText: string = '',
      countSugest: number = -1,
    ) => {
      mainApi.ml_handlers
        .mlAutocompleteStatus({
          field_name: 'main_diagnosis',
          description: value.length === 0 ? ' ' : value,
          selected_text: selectedText,
          n_candidates: countSugest,
          event_type: eventType,
        })
        .catch((error) => {
          console.error('Failed to send ML status:', error);
        });
    },
    [value],
  );

  const fetchAiCandidates = useCallback(async (text: string) => {
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
  }, []);
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
    setIsOpen(false);
    setSearchValue('');
    sendMlStatus('suggestion_selected', fullDiagnosis, diagnoses.length);
  };

  const handleAiSelect = (candidate: CandidatesItem) => {
    const fullDiagnosis = `${candidate.name}`;
    onValueChange(id, fullDiagnosis);
    setIsOpen(false);
    setSearchValue('');
    sendMlStatus('suggestion_selected', fullDiagnosis, aiCandidates.length);
  };
  useEffect(() => {
    if (isOpen && debouncedSearchValue.trim()) {
      fetchAiCandidates(debouncedSearchValue);
    }
  }, [debouncedSearchValue, isOpen, fetchAiCandidates]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onValueChange(id, newValue);
    setSearchValue(newValue);
    if (!isOpen) {
      setIsOpen(true);
    }
    if (newValue.length === 0) {
      setAiCandidates([]);
    }
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

  return (
    <div className="flex gap-2 flex-col relative" ref={containerRef}>
      <div className="text-[30px] pl-6 font-medium leading-[140%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
        {label}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onClick={() => {
            sendMlStatus('form_click');
            handleOpenWithReset();
          }}
          onFocus={handleOpenWithReset}
          placeholder="Введите код или название диагноза..."
          className="ml-6 text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full bg-transparent placeholder-gray-400 leading-[140%] py-2"
        />

        {isOpen && (
          <div className="absolute p-1.5 z-50 max-w-103.5 ml-6 mt-1 bg-white rounded-lg shadow-lg border-0 max-h-80 overflow-y-auto custom-scrollbar">
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
                  const fullText = `${cand.name}`;
                  return (
                    <div
                      key={`ai-${cand.code}`}
                      onClick={() => handleAiSelect(cand)}
                      className="px-2.5 py-1.5 flex flex-row gap-2.5 items-center cursor-pointer rounded-md transition-colors hover:bg-[#e6efff] text-[#202020]"
                    >
                      <div className="text-sm text-[#5D8CF1] text-right">
                        {percent}%
                      </div>
                      <div className="text-sm flex-1">{fullText}</div>
                    </div>
                  );
                })
              ) : (
                <div className="px-2.5 py-1.5 text-gray-400 text-sm">
                  Опишите диагноз система поможет его подобрать
                </div>
              )}
            </div>

            <h4 className="text-[#6C757D] text-[12px] font-medium">
              Все диагнозы
            </h4>
            <div className="py-1.5">
              {diagnoses.length === 0 &&
                !loading &&
                searchValue.trim() !== '' && (
                  <div className="px-2.5 py-1.5 text-gray-500 text-sm">
                    Диагнозы не найдены
                  </div>
                )}

              {diagnoses.length === 0 &&
                !loading &&
                searchValue.trim() === '' && (
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
        )}
      </div>
    </div>
  );
};
