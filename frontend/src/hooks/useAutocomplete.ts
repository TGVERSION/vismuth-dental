import { useState, useCallback, useEffect, useRef } from 'react';
import { CompletePayload, mlApi } from '@/lib/api';

interface UseAutocompleteOptions {
  sectionKey: string;
  debounceMs?: number;
  maxSuggestions?: number;
}

export const useAutocomplete = (
  query: string,
  { sectionKey, debounceMs = 300, maxSuggestions = 8 }: UseAutocompleteOptions,
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!query.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();

      try {
        setLoading(true);
        setError(null);

        const payload: CompletePayload = {
          field: sectionKey,
          prefix: query,
          num_sequences: maxSuggestions,
        };

        const response = await mlApi.search(payload);
        setSuggestions(response.suggestions || []);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'API Error';
        setError(errorMessage);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, sectionKey, debounceMs, maxSuggestions]);

  const handleSelect = useCallback((suggestion: string) => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, onSelect: (value: string) => void) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
            onSelect(suggestions[highlightedIndex]);
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, highlightedIndex, handleSelect],
  );

  return {
    suggestions,
    isOpen,
    setIsOpen,
    highlightedIndex,
    setHighlightedIndex,
    handleSelect,
    handleKeyDown,
    loading,
    error,
  };
};
