// Хранилище сессий анкеты — только для локальной разработки.
//
// Хранилище — временный файл, а не переменная в памяти: в dev каждый маршрут
// исполняется изолированно, и сессия, созданная в `POST /sessions`, не видна
// ни в `/messages`, ни в `/complete` — ни через модульную переменную, ни через
// globalThis. Это уже проверено в заглушке распознавания речи
// (`speech-mock/_mock/store.ts`), поэтому здесь повторяем тот же приём сразу.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentMockMode, type MockMode } from './mode';
import type { VisitType } from './script';

const STORE_FILE = join(tmpdir(), 'vismuth-questionnaire-mock.json');

export interface MockQuestionnaireSession {
  sessionId: string;
  linkCode: string;
  doctorId: string;
  createdAt: number;
  /** Режим, зафиксированный при создании сессии. */
  mode: MockMode;
  visitType: VisitType | null;
  /** Индекс текущего шага в списке для выбранной ветки. */
  stepIndex: number;
  /** Сколько уточняющих уже задано после текущего шага. */
  clarificationsAsked: number;
  /** Ответы пациента — только для счётчика, содержимое заглушке не нужно. */
  answers: number;
  finished: boolean;
  code: string | null;
}

type Store = Record<string, MockQuestionnaireSession>;

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

export const createSession = (
  linkCode: string,
  doctorId: string,
): MockQuestionnaireSession => {
  const store = readStore();
  const session: MockQuestionnaireSession = {
    sessionId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    linkCode,
    doctorId,
    createdAt: Date.now(),
    mode: currentMockMode(),
    visitType: null,
    stepIndex: 0,
    clarificationsAsked: 0,
    answers: 0,
    finished: false,
    code: null,
  };
  store[session.sessionId] = session;
  writeStore(store);
  return session;
};

export const getSession = (
  sessionId: string,
): MockQuestionnaireSession | undefined => readStore()[sessionId];

export const saveSession = (session: MockQuestionnaireSession): void => {
  const store = readStore();
  store[session.sessionId] = session;
  writeStore(store);
};

/**
 * Код из 4 цифр. Настоящий сервер обязан следить за уникальностью в клинике
 * за 30 дней; заглушке достаточно случайного — это видно из комментария,
 * чтобы требование не потерялось при переходе на реальный backend.
 */
export const issueCode = (session: MockQuestionnaireSession): string => {
  if (session.code) return session.code;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  session.code = code;
  saveSession(session);
  return code;
};
