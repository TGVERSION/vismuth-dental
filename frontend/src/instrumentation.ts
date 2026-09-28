import { logWarn } from '@/lib/logger';

/**
 * Выполняется один раз при запуске сервера Next. Production-сборка с
 * заглушками backend (MOCKS, src/lib/mocks.ts) показывает выдуманные данные —
 * это должно быть видно в логе контейнера, а не только в логе сборки.
 */
export function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const mocks = process.env.VISMUTH_MOCKS;
  if (!mocks) return;

  logWarn(
    `ВНИМАНИЕ: включены заглушки backend: ${mocks.split(',').join(', ')}. ` +
      'Сборка только для демо-контура.',
  );
}
