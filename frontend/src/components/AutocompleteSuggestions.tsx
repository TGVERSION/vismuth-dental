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

  // Пока летит запрос, показываем прежние подсказки. Раньше список на это
  // время размонтировался, и при непрерывном наборе панель мигала на каждой
  // букве. Новые подсказки просто заменяют старые, когда приходит ответ.
  if (suggestions.length === 0) return null;

  return (
    <ul
      aria-busy={loading}
      className="absolute z-50 w-full -mt-1 bg-[#F2F4F7] border-0 rounded-lg max-h-60 overflow-auto"
    >
      {suggestions.map((suggestion, index) => (
        <li
          // Ключ по индексу намеренно: список заменяется целиком, и при
          // одинаковом числе строк React обновит только текст, не пересоздавая
          // узлы. Ключ по тексту заставлял бы их размонтироваться.
          key={index}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(suggestion);
          }}
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
