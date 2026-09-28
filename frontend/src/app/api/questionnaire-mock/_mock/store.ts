// Хранилище анкет заглушки — только для разработки и демо-контура.
//
// Хранилище — временный файл, а не переменная в памяти: в dev каждый маршрут
// исполняется изолированно, и анкета, созданная в `POST /questionnaires`, не
// видна ни в `/step`, ни в `/answer` — ни через модульную переменную, ни через
// globalThis. Это уже проверено в заглушке распознавания речи
// (`speech-mock/_mock/store.ts`), поэтому здесь тот же приём.

import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newQuestionnaire, type MockQuestionnaire } from './flow';
import type { MockMode } from './mode';

const STORE_FILE = join(tmpdir(), 'vismuth-questionnaire-public-mock.json');

export interface StoredMockQuestionnaire extends MockQuestionnaire {
  /** Режим, зафиксированный при старте: `ai_down` и `slow` действуют на всю анкету. */
  mode: MockMode;
  createdAt: number;
}

type Store = Record<string, StoredMockQuestionnaire>;

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

/** Новая анкета с идентификатором и токеном — как у backend. */
export const createQuestionnaire = (
  mode: MockMode,
): StoredMockQuestionnaire => ({
  ...newQuestionnaire(randomUUID(), randomBytes(32).toString('base64url')),
  mode,
  createdAt: Date.now(),
});

export const getQuestionnaire = (
  id: string,
): StoredMockQuestionnaire | undefined => readStore()[id];

export const saveQuestionnaire = (
  questionnaire: StoredMockQuestionnaire,
): void => {
  const store = readStore();
  store[questionnaire.id] = questionnaire;
  writeStore(store);
};

/**
 * Код из 4 цифр. Настоящий сервер следит за уникальностью в клинике за 30
 * дней (`allocate_code`); заглушке достаточно случайного.
 */
export const issueCode = (): string =>
  String(Math.floor(1000 + Math.random() * 9000));
