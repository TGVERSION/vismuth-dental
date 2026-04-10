'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useAutocomplete } from '@/hooks/useAutocomplete';
import { AutocompleteSuggestions } from './AutocompleteSuggestions';
import { DiagnosisInput } from './DiagnosisInput';
import { mainApi } from '@/api';

export interface MlStatusPayload {
  field_name: string;
  description: string;
  selected_text: string;
  event_type: string;
}

export interface MlStatusResponse {
  detail: string;
}

interface SectionInputProps {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
  onLabelChange: (id: number, newLabel: string) => void;
  onValueChange: (id: number, newValue: string) => void;
}

export const SectionInput: React.FC<SectionInputProps> = ({
  id,
  label,
  value,
  sectionKey,
  onLabelChange,
  onValueChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

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

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    const timer = setTimeout(autoResize, 0);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (textareaRef.current) {
      autoResize();
    }
  }, []);

  const enableAutocomplete = () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
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
    <div className="flex gap-2 flex-col relative">
      <div className="text-[30px] pl-6 font-medium leading-[140%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
        {label}
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            enableAutocomplete();
            onValueChange(id, e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            setTimeout(() => autoResize(), 0);
          }}
          onClick={() => {
            enableAutocomplete();
            setIsOpen(true);
            sendMlStatus('form_click');
          }}
          onFocus={() => {
            enableAutocomplete();
            setIsOpen(true);
          }}
          onBlur={() => {
            enableAutocomplete();
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={(e) => handleKeyDown(e, handleSuggestionSelect)}
          className="ml-6 text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-webkit-fill-available resize-none bg-transparent placeholder-gray-400 overflow-hidden min-h-10 leading-[140%]"
          placeholder="Введите..."
          rows={1}
        />

        <AutocompleteSuggestions
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          onSelect={handleSuggestionClick}
          isOpen={isOpen}
          loading={loading}
        />
      </div>
    </div>
  );
};
