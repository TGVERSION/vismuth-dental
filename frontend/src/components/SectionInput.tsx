'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { AutocompleteSuggestions } from './AutocompleteSuggestions';
import { DiagnosisInput } from './DiagnosisInput';
import {
  mainApi,
  mlFullnessComplaintPayload,
  mlFullnessComplaintResponse,
} from '@/api';
import type { MkbEventType, StructureProtocolsFields } from '@/api';
import { Spinner } from './SpinnerFullnes';
import { FeedbackPopover } from './FeedbackPopover';
import { createPortal } from 'react-dom';
import { useHelpersStore } from '@/store/helpersStore';
import { RadioButton } from './RadioButton';
import { Checkbox } from './Checkbox';
import { CustomDropdown } from './CustomDropdown';
import { isComplaintsField, isMainDiagnosisField } from '@/lib/protocol-fields';
import { formatTextWithPlaceholders } from '@/lib/text';
import {
  formatMultiValue,
  parseMultiValue,
  toggleMultiValue,
} from '@/lib/field-values';
import { logError } from '@/lib/logger';

export interface MlStatusPayload {
  field_name: string;
  description: string;
  selected_text: string;
  event_type: string;
  n_candidates?: number;
}

interface SectionInputProps {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
  isActive?: boolean;
  onLabelChange: (id: number, newLabel: string) => void;
  onValueChange: (id: number, newValue: string) => void;
  onAnalysisChange?: (
    status: { color: string; analysis: string } | null,
  ) => void;
  fieldMeta?: StructureProtocolsFields;
}

function parseFieldOptions(jsonb: unknown): string[] {
  if (!jsonb || typeof jsonb !== 'object') return [];
  const data = jsonb as { options?: unknown };
  if (!Array.isArray(data.options)) return [];
  return (data.options as unknown[]).map(String).filter(Boolean);
}

export const SectionInput: React.FC<SectionInputProps> = ({
  id,
  label,
  value,
  sectionKey,
  onLabelChange: _onLabelChange,
  onValueChange,
  onAnalysisChange,
  isActive,
  fieldMeta,
}) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mlAnalysis, setMlAnalysis] =
    useState<mlFullnessComplaintResponse | null>(null);
  const [isFetchingAnalysis, setIsFetchingAnalysis] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const [animate, setAnimate] = useState(false);
  const prevActive = useRef(isActive);
  const { fullnessEnabled, autocompleteProvider } = useHelpersStore();

  const [dictOptions, setDictOptions] = useState<string[]>([]);
  const [isDictLoading, setIsDictLoading] = useState(false);

  const fieldType = fieldMeta?.field_type ?? 'text';
  const isTextField = fieldType === 'text';

  const isAutocompleteEnabled = autocompleteProvider !== 'off' && isTextField;
  const isFullnessEnabled = fullnessEnabled;
  const isComplaintField = isComplaintsField(sectionKey, label);
  // Типы полей, которые умеют подтягивать варианты из справочника.
  const usesDictionary =
    fieldType === 'select' ||
    fieldType === 'multiselect' ||
    fieldType === 'radio' ||
    fieldType === 'checkbox';

  useEffect(() => {
    if (isActive && prevActive.current === false) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
    prevActive.current = isActive;
  }, [isActive]);

  const {
    suggestions,
    isOpen,
    setIsOpen,
    highlightedIndex,
    setHighlightedIndex,
    handleSelect,
    handleKeyDown,
    loading,
  } = useAutocomplete(value, {
    sectionKey,
    debounceMs: 300,
    maxSuggestions: 8,
    enabled: hasUserInteracted && isAutocompleteEnabled,
    autocompleteType: autocompleteProvider,
  });

  // Fetch dictionary options for select/multiselect fields with a dictionary reference
  useEffect(() => {
    const dict = fieldMeta?.dictionary;
    if (!dict || !usesDictionary) return;

    let cancelled = false;
    setIsDictLoading(true);

    const fetchAll = async () => {
      const PAGE_SIZE = 100;
      let offset = 0;
      const allItems: Record<string, unknown>[] = [];
      let firstKey: string | null = null;

      while (true) {
        const res = await mainApi.dictionary.getDictionaryRef(dict, {
          limit: PAGE_SIZE,
          offset,
        });
        if (cancelled) return;
        if (!res.items.length) break;
        if (!firstKey) {
          const keys = Object.keys(res.items[0]).filter((k) => k !== 'row_id');
          firstKey =
            keys.find((k) => typeof res.items[0][k] !== 'number') ??
            keys[0] ??
            null;
        }
        allItems.push(...res.items);
        if (allItems.length >= res.total || res.items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      if (!firstKey) {
        setDictOptions([]);
        return;
      }
      setDictOptions(
        allItems.map((item) => String(item[firstKey!] ?? '')).filter(Boolean),
      );
    };

    fetchAll()
      .catch(() => setDictOptions([]))
      .finally(() => {
        if (!cancelled) setIsDictLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fieldMeta?.dictionary, usesDictionary]);

  const initialTextRef = useRef<string>('');
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    [],
  );

  const handleMouseEnter = useCallback(() => {
    clearTimeout(timerRef.current);
    if (indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect();
      setPopoverPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
      });
    }
    timerRef.current = setTimeout(() => setShowPopover(true), 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowPopover(false);
    }, 300);
  }, []);

  useEffect(() => {
    if (!showPopover) return;
    const handleScroll = () => setShowPopover(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showPopover]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const setCursorToEnd = (element: HTMLElement) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  useEffect(() => {
    if (isComplaintField) {
      onAnalysisChange?.(mlAnalysis);
    }
    // onAnalysisChange приходит из родителя инлайновой стрелкой: добавление
    // в зависимости вызвало бы цикл. Стабилизация колбэка — задача F-3.3.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mlAnalysis, isComplaintField]);

  // Синхронизация contentEditable со значением. Раньше пустое значение
  // дополнительно чистилось прямо в теле рендера — побочный эффект вне
  // useEffect несовместим с конкурентным рендерингом React.
  useEffect(() => {
    if (!editableRef.current || !isTextField) return;
    const currentText = editableRef.current.textContent ?? '';
    if (currentText !== value) {
      if (value === '') {
        editableRef.current.innerHTML = '';
      } else {
        editableRef.current.innerHTML = formatTextWithPlaceholders(value);
      }
    }
  }, [value, isTextField]);

  const enableAutocomplete = () => {
    if (!hasUserInteracted) setHasUserInteracted(true);
  };

  const sendMlStatus = (
    eventType: MkbEventType,
    selectedText: string = '',
    countSugest: number = -1,
  ) => {
    if (!isAutocompleteEnabled) return;

    mainApi.ml_handlers
      .mlAutocompleteStatus({
        field_name: sectionKey,
        description: value.length === 0 ? ' ' : value,
        selected_text: selectedText,
        n_candidates: countSugest,
        event_type: eventType,
        type_autocomplete: autocompleteProvider,
      })
      .catch((error) => {
        logError('Failed to send ML status:', error);
      });
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (editableRef.current) {
      editableRef.current.innerHTML = formatTextWithPlaceholders(suggestion);
      onValueChange(id, suggestion);
      handleSelect(suggestion);
      sendMlStatus('suggestion_selected', suggestion);
      editableRef.current.focus();
      setCursorToEnd(editableRef.current);
    }
  };

  const handleSuggestionSelect = (fullValue: string) => {
    if (editableRef.current) {
      editableRef.current.innerHTML = formatTextWithPlaceholders(fullValue);
      onValueChange(id, fullValue);
      handleSelect(fullValue);
      sendMlStatus('suggestion_selected', fullValue, 8);
      editableRef.current.focus();
      setCursorToEnd(editableRef.current);
    }
  };

  // Текст, ожидающий проверки, и признак идущего цикла. Раньше правка,
  // сделанная пока летел предыдущий запрос, молча отбрасывалась, и врач видел
  // оценку устаревшего текста.
  const pendingAnalysisTextRef = useRef<string | null>(null);
  const analysisRunningRef = useRef(false);

  const fetchMlAnalysis = useCallback(async (textToAnalyze: string) => {
    // Порог по длине убран намеренно: короткая запись — это ровно тот случай,
    // когда проверка полноты должна сказать «мало деталей».
    if (!textToAnalyze.trim()) return;

    pendingAnalysisTextRef.current = textToAnalyze;
    if (analysisRunningRef.current) return;

    analysisRunningRef.current = true;
    setIsFetchingAnalysis(true);
    setMlAnalysis(null);
    setAnalysisFailed(false);

    try {
      while (pendingAnalysisTextRef.current !== null) {
        const text = pendingAnalysisTextRef.current;
        pendingAnalysisTextRef.current = null;

        const payload: mlFullnessComplaintPayload = { example_prompt: text };
        const response =
          await mainApi.ml_handlers.mlFullnessComplaint(payload);

        // Пока запрос летел, врач мог дописать ещё — тогда результат уже
        // неактуален, и цикл пойдёт на следующий круг.
        if (pendingAnalysisTextRef.current === null) {
          setMlAnalysis(response);
        }
      }
    } catch (error) {
      logError('Не удалось проверить полноту жалоб:', error);
      setAnalysisFailed(true);
    } finally {
      pendingAnalysisTextRef.current = null;
      analysisRunningRef.current = false;
      setIsFetchingAnalysis(false);
    }
  }, []);

  const handleApplySuggestion = () => {
    if (mlAnalysis?.suggested_text) {
      onValueChange(id, mlAnalysis.suggested_text);
      setMlAnalysis(null);
      setAnalysisFailed(false);
      initialTextRef.current = '';
    }
  };

  const handlePlaceholderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('placeholder-bracket')) return;

    e.preventDefault();
    e.stopPropagation();

    const editable = editableRef.current;
    if (!editable) return;

    const parent = target.parentNode;
    const nextSibling = target.nextSibling;

    target.remove();

    const range = document.createRange();
    const selection = window.getSelection();

    if (parent) {
      if (nextSibling) {
        range.setStartBefore(nextSibling);
      } else {
        range.selectNodeContents(parent);
        range.collapse(false);
      }
    } else {
      range.setStart(editable, 0);
    }

    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const plainText = editable.textContent ?? '';
    onValueChange(id, plainText);
    initialTextRef.current = '';
  };

  const handleInput = () => {
    if (isComposing) return;
    if (!editableRef.current) return;

    const plainText = editableRef.current.textContent ?? '';
    onValueChange(id, plainText);

    if (isAutocompleteEnabled) {
      enableAutocomplete();
      setIsOpen(true);
      setHighlightedIndex(-1);
    }
    setMlAnalysis(null);
    setAnalysisFailed(false);
  };

  const handleFocus = () => {
    if (isAutocompleteEnabled) {
      enableAutocomplete();
      setIsOpen(true);
    }
    // Результат проверки при входе в поле не гасим: раньше он пропадал
    // навсегда, если врач заглянул в поле и вышел, ничего не изменив.
    // Устаревшую оценку снимает handleInput — при первой же правке текста.
    initialTextRef.current = value;
  };

  const handleBlur = () => {
    enableAutocomplete();
    // Задержка нужна, чтобы клик по подсказке успел отработать до закрытия
    // списка. Таймер держим в ref и снимаем при размонтировании.
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => setIsOpen(false), 200);

    if (
      isComplaintField &&
      isFullnessEnabled &&
      value &&
      value.trim().length > 0
    ) {
      if (value !== initialTextRef.current) {
        fetchMlAnalysis(value);
        initialTextRef.current = value;
      }
    }
  };

  const handleKeyDownEditable = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleKeyDown(e, handleSuggestionSelect);
  };

  // Подпись учитываем только для текстовых полей: поле «Диагноз» типа
  // «выбор из списка» не должно подменяться вводом с подбором МКБ-10.
  if (isMainDiagnosisField(sectionKey, isTextField ? label : undefined)) {
    return (
      <DiagnosisInput
        id={id}
        label={label}
        value={value}
        onValueChange={onValueChange}
        isActive={isActive}
      />
    );
  }

  const renderLabel = () => (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-4 h-4" ref={indicatorRef}>
        {isFullnessEnabled && isComplaintField && (
          <>
            {isFetchingAnalysis ? (
              <Spinner />
            ) : mlAnalysis ? (
              <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {showPopover &&
                  isComplaintField &&
                  !isFetchingAnalysis &&
                  createPortal(
                    <FeedbackPopover
                      color={mlAnalysis.color as 'green' | 'red' | 'yellow'}
                      analysis={mlAnalysis.analysis}
                      suggestedText={mlAnalysis.suggested_text}
                      onApply={handleApplySuggestion}
                      onClose={() => setShowPopover(false)}
                      style={{
                        position: 'fixed',
                        bottom: popoverPosition?.bottom,
                        left: popoverPosition?.left,
                        zIndex: 9999,
                      }}
                    />,
                    document.body,
                  )}
                <div
                  className={`w-4 h-4 cursor-pointer rounded-full transition-all duration-300 ${
                    mlAnalysis.color === 'green'
                      ? 'bg-[#459F49]'
                      : mlAnalysis.color === 'yellow'
                        ? 'bg-[#F29100]'
                        : 'bg-[#D91528]'
                  }`}
                />
              </div>
            ) : analysisFailed ? (
              // Раньше сбой запроса уходил только в консоль, и врач считал,
              // что проверка прошла и замечаний нет.
              <div
                className="w-4 h-4 rounded-full border-2 border-dashed border-[#909090]"
                title="Проверка полноты не выполнена. Попробуйте выйти из поля ещё раз."
                aria-label="Проверка полноты не выполнена"
              />
            ) : (
              <div className="w-3 h-3" />
            )}
          </>
        )}
      </div>
      <div
        className={`text-[30px] font-medium text-[#202020] mb-1 ${animate ? 'animate-scale-pulse' : ''}`}
      >
        {label}
      </div>
    </div>
  );

  // select field
  if (fieldType === 'select') {
    const opts = fieldMeta?.dictionary
      ? dictOptions
      : parseFieldOptions(fieldMeta?.default_value_jsonb);
    const dropdownOptions = opts.map((opt) => ({ value: opt, label: opt }));

    return (
      <div ref={containerRef} className="flex flex-col mb-6 relative">
        {renderLabel()}
        <div className="ml-7 mt-1">
          {isDictLoading ? (
            <div className="text-sm text-gray-400">Загрузка...</div>
          ) : (
            <CustomDropdown
              options={dropdownOptions}
              value={value}
              onChange={(v) => onValueChange(id, v)}
              placeholder="Выберите..."
            />
          )}
        </div>
      </div>
    );
  }

  // multiselect field — checkboxes allowing multiple values (stored as comma-separated)
  if (fieldType === 'multiselect') {
    const opts = fieldMeta?.dictionary
      ? dictOptions
      : parseFieldOptions(fieldMeta?.default_value_jsonb);
    const selectedValues = parseMultiValue(value, opts);

    const handleMultiselectChange = (opt: string, checked: boolean) => {
      const next = toggleMultiValue(selectedValues, opt, checked, opts);
      onValueChange(id, formatMultiValue(next));
    };

    return (
      <div ref={containerRef} className="flex flex-col mb-6 relative">
        {renderLabel()}
        <div className="ml-7 mt-2 flex flex-col gap-2">
          {isDictLoading ? (
            <div className="text-sm text-gray-400">Загрузка...</div>
          ) : (
            opts.map((opt) => (
              <Checkbox
                key={opt}
                id={`multiselect-${id}-${opt}`}
                checked={selectedValues.includes(opt)}
                onChange={(checked) => handleMultiselectChange(opt, checked)}
              >
                <span className="text-[16px] text-[#202020]">{opt}</span>
              </Checkbox>
            ))
          )}
        </div>
      </div>
    );
  }

  // radio field
  if (fieldType === 'radio') {
    const opts = fieldMeta?.dictionary
      ? dictOptions
      : parseFieldOptions(fieldMeta?.default_value_jsonb);

    return (
      <div ref={containerRef} className="flex flex-col mb-6 relative">
        {renderLabel()}
        <div className="ml-7 mt-2 flex flex-col gap-2">
          {isDictLoading ? (
            <div className="text-sm text-gray-400">Загрузка...</div>
          ) : (
            opts.map((opt) => (
              <RadioButton
                key={opt}
                id={`radio-${id}-${opt}`}
                name={`radio-${sectionKey}-${id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onValueChange(id, opt)}
              >
                <span className="text-[16px] text-[#202020]">{opt}</span>
              </RadioButton>
            ))
          )}
        </div>
      </div>
    );
  }

  // checkbox field — multiple choices, stored as comma-separated
  if (fieldType === 'checkbox') {
    const opts = fieldMeta?.dictionary
      ? dictOptions
      : parseFieldOptions(fieldMeta?.default_value_jsonb);
    const selectedValues = parseMultiValue(value, opts);

    const handleCheckboxChange = (opt: string, checked: boolean) => {
      const next = toggleMultiValue(selectedValues, opt, checked, opts);
      onValueChange(id, formatMultiValue(next));
    };

    return (
      <div ref={containerRef} className="flex flex-col mb-6 relative">
        {renderLabel()}
        <div className="ml-7 mt-2 flex flex-col gap-2">
          {isDictLoading ? (
            <div className="text-sm text-gray-400">Загрузка...</div>
          ) : (
            opts.map((opt) => (
              <Checkbox
                key={opt}
                id={`checkbox-${id}-${opt}`}
                checked={selectedValues.includes(opt)}
                onChange={(checked) => handleCheckboxChange(opt, checked)}
              >
                <span className="text-[16px] text-[#202020]">{opt}</span>
              </Checkbox>
            ))
          )}
        </div>
      </div>
    );
  }

  // Default: text field with contentEditable, autocomplete and ML analysis
  return (
    <div ref={containerRef} className="flex flex-col mb-6 relative">
      <div className="grow relative">
        {renderLabel()}

        <div className="flex ml-7 items-center gap-3">
          <div className="relative w-full">
            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDownEditable}
              onClick={(e) => {
                enableAutocomplete();
                setIsOpen(true);
                sendMlStatus('form_click');
                handlePlaceholderClick(e);
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => {
                setIsComposing(false);
                handleInput();
              }}
              className="text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full resize-none bg-transparent min-h-5.5 text-[16px] whitespace-pre-wrap wrap-break-word"
              style={{ wordBreak: 'break-word' }}
              role="textbox"
              aria-multiline="true"
              data-placeholder="Введите..."
            />
            {isAutocompleteEnabled && (
              <AutocompleteSuggestions
                suggestions={suggestions}
                highlightedIndex={highlightedIndex}
                onSelect={handleSuggestionClick}
                isOpen={isOpen}
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
