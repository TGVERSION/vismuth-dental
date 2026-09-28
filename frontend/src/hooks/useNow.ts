'use client';

import { useEffect, useState } from 'react';

/**
 * Текущее время с обновлением по интервалу. Нужен разметке, которая зависит
 * от «сейчас» и должна меняться, пока страница открыта: например, приём,
 * время которого наступило, приглушается без перезагрузки.
 */
export const useNow = (intervalMs = 60_000): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};
