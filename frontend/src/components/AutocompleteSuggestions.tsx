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
      className="absolute z-[var(--ui-z-popover)] mt-1 w-full rounded-[var(--ui-radius-lg)] bg-[var(--ui-color-alabaster-50)] p-[var(--ui-space-6)] shadow-[var(--ui-shadow)] max-h-60 overflow-auto"
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
          className={`rounded-[var(--ui-radius-md)] px-[var(--ui-space-10)] py-[var(--ui-space-6)] cursor-pointer text-sm transition-colors ${
            index === highlightedIndex
              ? 'bg-[var(--ui-color-blue-100)] text-[var(--ui-color-blue-600)]'
              : 'hover:bg-[var(--ui-color-alabaster-500)] text-[var(--ui-color-alabaster-dark-800)]'
          }`}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  );
};
