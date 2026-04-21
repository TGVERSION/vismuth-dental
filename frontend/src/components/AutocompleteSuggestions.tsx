import React from 'react';

interface AutocompleteSuggestionsProps {
  suggestions: string[];
  highlightedIndex: number;
  onSelect: (value: string) => void;
  isOpen: boolean;
  loading?: boolean;
}

export const AutocompleteSuggestions: React.FC<
  AutocompleteSuggestionsProps
> = ({ suggestions, highlightedIndex, onSelect, isOpen, loading = false }) => {
  if (!isOpen) return null;

  if (loading) {
    return null;
  }

  if (suggestions.length === 0) return null;

  return (
    <ul className="absolute z-50 w-full -mt-1 bg-[#F2F4F7] border-0 rounded-lg max-h-60 overflow-auto">
      {suggestions.map((suggestion, index) => (
        <li
          key={index}
          onMouseDown={() => onSelect(suggestion)}
          className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
            index === highlightedIndex
              ? 'bg-[#e6efff] text-[#202020]'
              : 'hover:bg-[#e6efff] text-[#202020]'
          }`}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  );
};
