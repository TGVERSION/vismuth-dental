// Какая анкета → какой протокол уже создан. Только для локальной разработки.
//
// Хранилище — временный файл, а не переменная в памяти: в dev каждый маршрут
// исполняется изолированно, и связь, записанная в `POST …/protocol`, не была
// бы видна в `GET` списка и анкеты. Тот же приём — в заглушках анкеты
// пациента и распознавания речи.

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STORE_FILE = join(tmpdir(), 'vismuth-doctor-questionnaires-mock.json');

type Store = Record<string, string>;

const readStore = (): Store => {
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Store;
  } catch {
    // Файла ещё нет или он повреждён — начинаем с пустого хранилища.
    return {};
  }
};

export const getProtocolId = (questionnaireId: string): string | null =>
  readStore()[questionnaireId] ?? null;

export const setProtocolId = (
  questionnaireId: string,
  protocolId: string,
): void => {
  const store = readStore();
  store[questionnaireId] = protocolId;
  try {
    writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
  } catch {
    // Заглушка не должна ронять маршрут из-за проблем с временным файлом.
  }
};
