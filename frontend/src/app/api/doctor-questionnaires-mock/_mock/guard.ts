// Общая обвязка ВРЕМЕННОЙ заглушки врачебных эндпоинтов анкет (PL-253).
//
// Запросы на `/api/main/questionnaires*` направляет сюда правило beforeFiles
// из `next.config.ts` — в разработке, если не задано
// `DOCTOR_QUESTIONNAIRES_MOCK=off`, и в сборке демо-контура с MOCKS
// (src/lib/mocks.ts). Заглушка ПЕРЕКРЫВАЕТ настоящий backend: реальных анкет
// в базе нет, а интерфейс пациента пока не совместим с backend.
//
// Удалить правило и всю папку отдельной задачей, когда выполнены оба условия:
//   1. на dev-стенде есть обработанные анкеты врача — через анкету пациента
//      после согласования её контракта с backend или сидом в базе;
//   2. backend перестал отдавать в списке необработанные анкеты или начал
//      присылать в нём `processing_status` (ВЗ-6 в docs/plans/PL-253).
//
// В остальных сборках правила нет, запрос уходит на backend, а эти маршруты
// при прямом обращении отвечают 404 — каждый обработчик начинается с проверки
// `isMockEnabled`.

import { NextResponse } from 'next/server';
import { isBuiltWithMock } from '@/lib/mocks';

export const isMockEnabled = isBuiltWithMock('doctor-questionnaires');

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

/** Заглушка не проверяет подпись токена, но без него ведёт себя как backend. */
export const requireAuth = (request: Request): string | null =>
  request.headers.get('authorization');

export const unauthorized = () =>
  NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

/** Как backend для пользователя без membership врача. */
export const forbidden = () =>
  NextResponse.json({ detail: 'Doctor membership required' }, { status: 403 });

export const unprocessable = (detail: string) =>
  NextResponse.json({ detail }, { status: 422 });

export const conflict = (detail: string) =>
  NextResponse.json({ detail }, { status: 409 });

export const serverError = () =>
  NextResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
