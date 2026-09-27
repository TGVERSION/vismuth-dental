// Общая обвязка маршрутов-заглушки анкеты пациента.
//
// Заглушка живёт по собственному пути `/api/questionnaire-mock/*`, а запросы
// на `/api/main/questionnaire/*` направляет сюда правило beforeFiles из
// `next.config.ts` — и только в разработке. В production правила нет, запрос
// уходит на настоящий backend, а эти маршруты остаются недостижимыми и на
// всякий случай отвечают 404.
//
// В отличие от speech-mock проверки `Authorization` здесь нет и быть не
// должно: эндпоинты анкеты публичные, пациент проходит её без аккаунта.

import { NextResponse } from 'next/server';

export const isMockEnabled = process.env.NODE_ENV !== 'production';

export const notFound = () =>
  NextResponse.json({ detail: 'Not Found' }, { status: 404 });

export const badRequest = (detail: string) =>
  NextResponse.json({ detail }, { status: 422 });
