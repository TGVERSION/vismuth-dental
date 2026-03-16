'use client';

import { useAutocomplete } from '@/hooks/useAutocomplete';
import { ChangeEvent, useEffect, useRef } from 'react';
import { AutocompleteSuggestions } from './AutocompleteSuggestions';

interface SectionInputProps {
  id: number;
  label: string;
  value: string;
  onLabelChange: (id: number, newLabel: string) => void;
  onValueChange: (id: number, newValue: string) => void;
}

export const SectionInput: React.FC<SectionInputProps> = ({
  id,
  label,
  value,
  onLabelChange,
  onValueChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    suggestions,
    isOpen,
    setIsOpen,
    highlightedIndex,
    setHighlightedIndex,
    handleSelect,
    handleKeyDown,
    getFullValueAfterSelect,
  } = useAutocomplete(label, value);

  const autoResize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      autoResize();
    }, 0);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (textareaRef.current) {
      autoResize();
    }
  }, []);

  const handleSuggestionClick = (suggestion: string) => {
    const fullValue = getFullValueAfterSelect(suggestion);
    onValueChange(id, fullValue);
    handleSelect(suggestion);
  };

  const handleSuggestionSelect = (fullValue: string) => {
    onValueChange(id, fullValue);
    handleSelect(fullValue);
  };

  return (
    <div className="flex gap-2 flex-col relative">
      <input
        type="text"
        value={label}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onLabelChange(id, e.target.value)
        }
        className="text-[30px] pl-6 font-medium leading-[140%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full"
      />

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            onValueChange(id, e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            setTimeout(() => autoResize(), 0);
          }}
          onClick={() => {
            if (label === 'Диагноз') {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          onKeyDown={(e) => handleKeyDown(e, handleSuggestionSelect)}
          className="ml-6 text-[#202020] border-0 focus:border-0 focus:outline-none focus:ring-0 w-full resize-none bg-transparent placeholder-gray-400 overflow-hidden min-h-[40px] leading-[140%]"
          placeholder="Введите..."
          rows={1}
        />

        <AutocompleteSuggestions
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          onSelect={handleSuggestionClick}
          isOpen={isOpen}
        />
      </div>
    </div>
  );
};
