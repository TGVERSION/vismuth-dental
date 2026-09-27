// Общая обвязка маршрутов-заглушки.
//
// Заглушка живёт по собственному пути `/api/speech-mock/*`, а запросы на
// `/api/main/speech/*` направляет сюда правило beforeFiles из `next.config.ts`
// — и только в разработке. В production правила нет, запрос уходит на
// настоящий backend, а эти маршруты остаются недостижимыми и на всякий случай
// отвечают 404.

import { NextResponse } from 'next/server';

export const isMockEnabled = process.env.NODE_ENV !== 'production';

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

/** Заглушка не проверяет подпись токена, но без него ведёт себя как backend. */
export const requireAuth = (request: Request): string | null =>
  request.headers.get('authorization');

export const unauthorized = () =>
  NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
