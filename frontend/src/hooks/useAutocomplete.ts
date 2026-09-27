import { useState, useCallback, useEffect, useRef } from 'react';
import { CompletePayload, mainApi } from '@/api';
import { isAbortError } from '@/api/base-client';

interface UseAutocompleteOptions {
  sectionKey: string;
  debounceMs?: number;
  maxSuggestions?: number;
  enabled?: boolean;
  autocompleteType?: 'ml_autocomplete' | 'dict_autocomplete' | 'off';
}

export const useAutocomplete = (
  query: string,
  {
    sectionKey,
    debounceMs = 300,
    maxSuggestions = 8,
    enabled = true,
    autocompleteType = 'dict_autocomplete',
  }: UseAutocompleteOptions,
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Номер запроса: ответ применяется, только если он относится к последнему
  // отправленному. Одной отмены мало — ответ мог уже быть в пути.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!enabled || !query.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      try {
        setLoading(true);
        setError(null);

        const payload: CompletePayload = {
          field_name: sectionKey,
          prefix: query,
          suggestions_count: maxSuggestions,
          type_autocomplete:
            autocompleteType !== 'off' ? autocompleteType : undefined,
        };

        const response = await mainApi.ml_handlers.mlAutocomplete(payload, {
          signal: controller.signal,
        });

        if (requestId !== requestIdRef.current) return;
        setSuggestions(response.suggestions || []);
      } catch (err: unknown) {
        // Отмена — штатное завершение: врач продолжил печатать.
        if (isAbortError(err)) return;
        if (requestId !== requestIdRef.current) return;

        const errorMessage = err instanceof Error ? err.message : 'API Error';
        setError(errorMessage);
        setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
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
  }, [
    query,
    sectionKey,
    debounceMs,
    maxSuggestions,
    enabled,
    autocompleteType,
  ]);

  const handleSelect = useCallback((_suggestion: string) => {
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
