// Общая обвязка заглушки помощника «Обоснование для ДМС» (PL-314).
//
// Эндпоинта `POST /ml_clinrec_dms` в backend нет: контракт предложен в
// docs/plans/PL-314/02-development-plan.md и ждёт согласования (E-5). Запрос
// на `/api/main/ml_clinrec_dms` направляет сюда правило beforeFiles из
// `next.config.ts` — в разработке и в сборке демо-контура с MOCKS
// (src/lib/mocks.ts). В остальных сборках правила нет, запрос уходит на
// backend, а этот маршрут при прямом обращении отвечает 404.
//
// Удалить правило и папку, когда backend выкатит эндпоинт.

import { NextResponse } from 'next/server';
import { isBuiltWithMock } from '@/lib/mocks';

export const isMockEnabled = isBuiltWithMock('dms');

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

/** Заглушка не проверяет подпись токена, но без него ведёт себя как backend. */
export const requireAuth = (request: Request): string | null =>
  request.headers.get('authorization');

export const unauthorized = () =>
  NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
