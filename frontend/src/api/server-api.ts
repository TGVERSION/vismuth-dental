// Серверные запросы к backend. Только для серверных компонентов.
//
// ВАЖНО: этот модуль НЕ реэкспортируется из `src/api/index.ts`. Оттуда
// импортируют клиентские компоненты (SectionInput, DiagnosisInput,
// CreateGroupPopup, экран входа), и реэкспорт затянул бы серверный код
// и адрес backend в клиентский бандл.
//
// Это единственное место в коде с абсолютным адресом backend. Правило
// frontend/AGENTS.md («только относительные пути через прокси») писалось
// под клиентский axios: серверный `fetch` не проходит через rewrites Next,
// потому что rewrites работают для входящих запросов к серверу, а не для
// исходящих из него. Адрес держим здесь и никуда не распространяем.

import { cache } from 'react';
import { headers } from 'next/headers';
import { logError } from '@/lib/logger';
import { isBuiltWithMock } from '@/lib/mocks';
import type { QuestionnaireLink } from './index';

/**
 * Бюджет ожидания. Запрос блокирует первый байт HTML: лучше отдать анкету
 * в нейтральной теме, чем показать пациенту белый экран.
 */
const SERVER_FETCH_TIMEOUT_MS = 1500;

/**
 * Куда идти за данными.
 *
 * В production — прямо в backend. В разработке — на собственный origin Next,
 * чтобы запрос прошёл через правило `beforeFiles` и попал в заглушку.
 *
 * Хост берётся из заголовка входящего запроса, а не из `process.env.PORT`:
 * `next dev` эту переменную не выставляет, и на нестандартном порту
 * (`next dev -p 3001`) запрос ушёл бы в никуда, а брендинг молча
 * деградировал бы в нейтральную тему — отладка пошла бы по ложному следу.
 *
 * Сборка демо-контура с заглушкой анкеты (MOCKS) идёт в собственный сервер
 * по внутреннему адресу. Хост из заголовка там не годится: за прокси это
 * публичный адрес сайта, и из контейнера он может быть недоступен. `PORT`
 * standalone-сервер получает из Dockerfile.
 */
const resolveBaseUrl = async (): Promise<string> => {
  if (process.env.NODE_ENV === 'production') {
    if (isBuiltWithMock('questionnaire')) {
      return `http://127.0.0.1:${process.env.PORT || 3000}/api/main`;
    }
    return process.env.API_MAIN_URL || 'http://localhost:8000';
  }

  const host = (await headers()).get('host') || '127.0.0.1:3000';
  return `http://${host}/api/main`;
};

/**
 * Данные ссылки анкеты: брендинг клиники, на кого ведёт ссылка, состояние.
 *
 * Обёрнуто в `cache`: `generateMetadata` и сам компонент страницы — две
 * разные функции, и без обёртки на каждый показ анкеты уходило бы два
 * запроса, оба в бюджете таймаута и оба блокирующие первый байт.
 *
 * Возвращает `null` при любой проблеме. Текст ошибки backend наружу не идёт
 * и в лог попадает только меткой: в ответе могут быть служебные данные.
 */
export const getQuestionnaireLink = cache(
  async (code: string): Promise<QuestionnaireLink | null> => {
    try {
      const baseUrl = await resolveBaseUrl();
      const response = await fetch(
        `${baseUrl}/questionnaire/link/${encodeURIComponent(code)}`,
        {
          // Страница публичная и разная для каждой клиники: кэш здесь
          // означал бы показать пациенту брендинг чужой клиники.
          cache: 'no-store',
          signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        logError('Анкета: ссылка не загружена');
        return null;
      }

      return (await response.json()) as QuestionnaireLink;
    } catch (error) {
      logError('Анкета: ошибка загрузки ссылки', error);
      return null;
    }
  },
);
