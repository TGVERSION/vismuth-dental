// Заглушка сервиса распознавания приёма — только для локальной разработки.
//
// Эндпоинтов `/speech/*` в backend ещё нет, поэтому маршруты в этом каталоге
// перехватывают их до rewrite на реальный сервер и изображают работу сервиса:
// принимают фрагменты, «обрабатывают» запись и возвращают распределение
// текста по полям протокола.
//
// Что здесь настоящее, а что нет:
// - настоящие: идентификаторы полей структуры (мок запрашивает их у backend
//   тем же токеном, что прислал браузер) — иначе результат некуда разложить;
// - ненастоящий: сам текст. Он генерируется по подписям полей и помечен как
//   демонстрационный, чтобы его нельзя было принять за расшифровку.
//
// Хранилище — временный файл, а не переменная в памяти: в dev каждый маршрут
// исполняется изолированно, и сессия, созданная в `POST /sessions`, не видна
// ни в `/chunks`, ни в `/complete` — ни через модульную переменную, ни через
// globalThis. Проверено запросами: список сессий работал, а обращение к той же
// сессии из соседнего маршрута отвечало 404.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentMockMode, type MockMode } from './mode';

const PROCESSING_MS = 6000;
const STORE_FILE = join(tmpdir(), 'vismuth-speech-mock.json');

export interface MockSession {
  sessionId: string;
  protocolId: string;
  createdAt: number;
  chunks: number;
  completedAt: number | null;
  /** Режим сбоя, зафиксированный при завершении записи. */
  mode?: MockMode;
}

type Store = Record<string, MockSession>;

const readStore = (): Store => {
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Store;
  } catch {
    // Файла ещё нет или он повреждён — начинаем с пустого хранилища.
    return {};
  }
};

const writeStore = (store: Store): void => {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
  } catch {
    // Заглушка не должна ронять маршрут из-за проблем с временным файлом.
  }
};

export const createSession = (protocolId: string): MockSession => {
  const store = readStore();
  const session: MockSession = {
    sessionId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    protocolId,
    createdAt: Date.now(),
    chunks: 0,
    completedAt: null,
  };
  store[session.sessionId] = session;
  writeStore(store);
  return session;
};

export const getSession = (sessionId: string): MockSession | undefined =>
  readStore()[sessionId];

export const findSessionsByProtocol = (protocolId: string): MockSession[] =>
  Object.values(readStore())
    .filter((session) => session.protocolId === protocolId)
    // Сессии, записанные до появления поля, считаем самыми старыми.
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

/**
 * Учёт фрагмента идемпотентен по `seq`: повторная отправка того же номера
 * после обрыва связи не удваивает фрагмент — ровно то требование, которое
 * выставлено настоящему backend.
 */
export const addChunk = (sessionId: string, seq: number): void => {
  const store = readStore();
  const session = store[sessionId];
  if (!session) return;

  session.chunks = Math.max(session.chunks, seq + 1);
  writeStore(store);
};

export const completeSession = (sessionId: string): MockSession | undefined => {
  const store = readStore();
  const session = store[sessionId];
  if (!session) return undefined;

  if (session.completedAt === null) {
    session.completedAt = Date.now();
    session.mode = currentMockMode();
    // Режим lost: сервер «теряет» сессию сразу после завершения записи.
    // Ответ на само завершение уходит обычный — сбой проявится при опросе.
    if (session.mode === 'lost') delete store[sessionId];
    writeStore(store);
  }
  return session;
};

export const dropSession = (sessionId: string): void => {
  const store = readStore();
  delete store[sessionId];
  writeStore(store);
};

/** Обработка «идёт» фиксированное время после завершения записи. */
export const isProcessingDone = (session: MockSession): boolean =>
  session.completedAt !== null &&
  Date.now() - session.completedAt >= PROCESSING_MS;

export const processingProgress = (session: MockSession): number => {
  if (session.completedAt === null) return 0;
  const elapsed = Date.now() - session.completedAt;
  return Math.min(1, Math.round((elapsed / PROCESSING_MS) * 100) / 100);
};
