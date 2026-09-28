// Общая обвязка маршрутов-заглушки.
//
// Заглушка живёт по собственному пути `/api/speech-mock/*`, а запросы на
// `/api/main/speech/*` направляет сюда правило beforeFiles из `next.config.ts`
// — в разработке и в сборке демо-контура с MOCKS (src/lib/mocks.ts). В
// остальных сборках правила нет, запрос уходит на настоящий backend, а эти
// маршруты на всякий случай отвечают 404.

import { NextResponse } from 'next/server';
import { isBuiltWithMock } from '@/lib/mocks';

export const isMockEnabled = isBuiltWithMock('speech');

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

/** Заглушка не проверяет подпись токена, но без него ведёт себя как backend. */
export const requireAuth = (request: Request): string | null =>
  request.headers.get('authorization');

export const unauthorized = () =>
  NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
