// Общая обвязка маршрутов-заглушки анкеты пациента.
//
// Заглушка живёт по собственному пути `/api/questionnaire-mock/*`, а запросы
// на `/api/main/questionnaire/*` направляет сюда правило beforeFiles из
// `next.config.ts` — в разработке и в сборке демо-контура с MOCKS
// (src/lib/mocks.ts). В остальных сборках правила нет, запрос уходит на
// настоящий backend, а эти маршруты на всякий случай отвечают 404.
//
// В отличие от speech-mock проверки `Authorization` здесь нет и быть не
// должно: эндпоинты анкеты публичные, пациент проходит её без аккаунта.

import { NextResponse } from 'next/server';
import { isBuiltWithMock } from '@/lib/mocks';

export const isMockEnabled = isBuiltWithMock('questionnaire');

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

export const badRequest = (detail: string) =>
  NextResponse.json({ detail }, { status: 422 });
