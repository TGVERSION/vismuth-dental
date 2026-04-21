'use client';

import { ChangeEvent, useEffect, useRef, useState, useCallback } from 'react';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { AutocompleteSuggestions } from './AutocompleteSuggestions';
import { DiagnosisInput } from './DiagnosisInput';
import {
  mainApi,
  mlFullnessComplaintPayload,
  mlFullnessComplaintResponse,
} from '@/api';
import { Spinner } from './SpinnerFullnes';
import { FeedbackPopover } from './FeedbackPopover';

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
  onLabelChange: (id: number, newLabel: string) => void;
  onValueChange: (id: number, newValue: string) => void;
}

const getPlainTextFromHTML = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const formatTextWithPlaceholders = (text: string): string => {
  return text.replace(
    /\[([^\]]+)\]/g,
    '<span class="placeholder-bracket" data-placeholder="$1">[$1]</span>',
  );
};

export const SectionInput: React.FC<SectionInputProps> = ({
  id,
  label,
  value,
  sectionKey,
  onLabelChange,
  onValueChange,
}) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [mlAnalysis, setMlAnalysis] =
    useState<mlFullnessComplaintResponse | null>(null);
  const [isFetchingAnalysis, setIsFetchingAnalysis] = useState(false);

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
    enabled: hasUserInteracted,
  });

  // Синхронизация содержимого с value
  useEffect(() => {
    if (!editableRef.current) return;
    const currentText = getPlainTextFromHTML(editableRef.current.innerHTML);
    if (currentText !== value) {
      if (value === '') {
        editableRef.current.innerHTML = '';
      } else {
        editableRef.current.innerHTML = formatTextWithPlaceholders(value);
      }
    }
  }, [value]);

  const enableAutocomplete = () => {
    if (!hasUserInteracted) setHasUserInteracted(true);
  };

  const sendMlStatus = (
    eventType: string,
    selectedText: string = '',
    countSugest: number = -1,
  ) => {
    mainApi.ml_handlers
      .mlAutocompleteStatus({
        field_name: sectionKey,
        description: value.length === 0 ? ' ' : value,
        selected_text: selectedText,
        n_candidates: countSugest,
        event_type: eventType,
      })
      .catch((error) => {
        console.error('Failed to send ML status:', error);
      });
  };

  const handleSuggestionClick = (suggestion: string) => {
    onValueChange(id, suggestion);
    handleSelect(suggestion);
    sendMlStatus('suggestion_selected', suggestion);
  };

  const handleSuggestionSelect = (fullValue: string) => {
    onValueChange(id, fullValue);
    handleSelect(fullValue);
    sendMlStatus('suggestion_selected', fullValue, 8);
  };

  const fetchMlAnalysis = useCallback(
    async (textToAnalyze: string) => {
      if (isFetchingAnalysis) return;
      if (!textToAnalyze || textToAnalyze.trim().length < 5) return;

      setIsFetchingAnalysis(true);
      setMlAnalysis(null);
      const dataToSend: mlFullnessComplaintPayload = {
        example_prompt: textToAnalyze,
      };
      try {
        const response =
          await mainApi.ml_handlers.mlFullnessComplaint(dataToSend);
        setMlAnalysis(response);
      } catch (error) {
        console.error('Failed to fetch analysis:', error);
      } finally {
        setIsFetchingAnalysis(false);
      }
    },
    [isFetchingAnalysis],
  );

  const handleApplySuggestion = () => {
    if (mlAnalysis?.suggested_text) {
      onValueChange(id, mlAnalysis.suggested_text);
      setMlAnalysis(null);
    }
  };

  const closeMlFeedback = () => {
    setMlAnalysis(null);
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

    const plainText = getPlainTextFromHTML(editable.innerHTML);
    onValueChange(id, plainText);
  };

  const handleInput = () => {
    if (isComposing) return;
    if (!editableRef.current) return;

    const plainText = getPlainTextFromHTML(editableRef.current.innerHTML);
    onValueChange(id, plainText);
    enableAutocomplete();
    setIsOpen(true);
    setHighlightedIndex(-1);
    setMlAnalysis(null);
  };

  const handleFocus = () => {
    enableAutocomplete();
    setIsOpen(true);
    closeMlFeedback();
  };

  const handleBlur = () => {
    enableAutocomplete();
    setTimeout(() => setIsOpen(false), 200);
    if (isComplaintField && value && value.trim().length > 0) {
      fetchMlAnalysis(value);
    }
  };

  const handleKeyDownEditable = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleKeyDown(e, handleSuggestionSelect);
  };

  const isComplaintField =
    sectionKey === 'complaints' || sectionKey === 'chief_complaint';

  if (sectionKey === 'main_diagnosis') {
    return (
      <DiagnosisInput
        id={id}
        label={label}
        value={value}
        onValueChange={onValueChange}
      />
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col mb-6 relative">
      <div className="flex-grow relative">
        <div className="text-[30px] font-medium ml-6 leading-[140%] text-[#202020] mb-1">
          {label}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-4 h-4">
            {isFetchingAnalysis ? (
              <Spinner />
            ) : mlAnalysis ? (
              <div
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  mlAnalysis.color === 'green'
                    ? 'bg-[#459F49]'
                    : mlAnalysis.color === 'yellow'
                      ? 'bg-[#F29100]'
                      : 'bg-[#D91528]'
                }`}
                title={mlAnalysis.analysis}
              />
            ) : (
              <div className="w-3 h-3" />
            )}
          </div>
          <div className="relative w-full">
            {/* Contenteditable div всегда отображается */}
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
              className="text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full resize-none bg-transparent min-h-10 leading-[140%] text-[16px] whitespace-pre-wrap break-words"
              style={{ wordBreak: 'break-word' }}
              role="textbox"
              aria-multiline="true"
              data-placeholder="Введите..."
            />

            <AutocompleteSuggestions
              suggestions={suggestions}
              highlightedIndex={highlightedIndex}
              onSelect={handleSuggestionClick}
              isOpen={isOpen}
              loading={loading}
            />

            {isComplaintField && mlAnalysis && !isFetchingAnalysis && (
              <FeedbackPopover
                color={mlAnalysis.color}
                analysis={mlAnalysis.analysis}
                suggestedText={mlAnalysis.suggested_text}
                onApply={handleApplySuggestion}
                onClose={closeMlFeedback}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
