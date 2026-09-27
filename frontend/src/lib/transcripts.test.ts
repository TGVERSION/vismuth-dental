import { describe, it, expect } from 'vitest';
import {
  formatTranscriptLabel,
  resolveSelectedTranscript,
  selectTranscriptItems,
} from './transcripts';
import type { SpeechSessionStatus } from '@/api';

const session = (
  overrides: Partial<SpeechSessionStatus>,
): SpeechSessionStatus => ({
  session_id: 'session',
  protocol_id: 'protocol',
  status: 'done',
  created_at: null,
  progress: 1,
  transcript: 'Текст расшифровки',
  field_values: null,
  error: null,
  ...overrides,
});

describe('selectTranscriptItems', () => {
  it('оставляет готовые записи с текстом и упавшие', () => {
    const items = selectTranscriptItems([
      session({ session_id: 'done' }),
      session({ session_id: 'failed', status: 'error', transcript: null }),
      session({ session_id: 'processing', status: 'processing' }),
      session({ session_id: 'recording', status: 'recording' }),
      session({ session_id: 'empty', transcript: '   ' }),
      session({ session_id: 'null', transcript: null }),
    ]);

    expect(items.map((item) => item.sessionId)).toEqual(['done', 'failed']);
  });

  // Приём, который не попал в протокол, не должен исчезать бесследно.
  it('сохраняет у упавшей записи статус и причину', () => {
    const [failed] = selectTranscriptItems([
      session({ status: 'error', transcript: null, error: 'тихая запись' }),
    ]);

    expect(failed.status).toBe('error');
    expect(failed.error).toBe('тихая запись');
  });

  it('упорядочивает записи от старой к новой', () => {
    const items = selectTranscriptItems([
      session({ session_id: 'поздняя', created_at: '2026-09-14T12:00:00Z' }),
      session({ session_id: 'ранняя', created_at: '2026-09-14T09:00:00Z' }),
    ]);

    expect(items.map((item) => item.sessionId)).toEqual(['ранняя', 'поздняя']);
  });

  // Запись без времени не должна вклиниваться между датированными.
  it('ставит записи без времени первыми', () => {
    const items = selectTranscriptItems([
      session({
        session_id: 'датированная',
        created_at: '2026-09-14T09:00:00Z',
      }),
      session({ session_id: 'без времени', created_at: null }),
    ]);

    expect(items[0].sessionId).toBe('без времени');
  });
});

describe('formatTranscriptLabel', () => {
  it('нумерует записи с единицы', () => {
    expect(formatTranscriptLabel(0, null)).toBe('Запись 1');
    expect(formatTranscriptLabel(2, null)).toBe('Запись 3');
  });

  it('добавляет время, если оно известно', () => {
    const label = formatTranscriptLabel(1, '2026-09-14T09:05:00Z');

    expect(label.startsWith('Запись 2 · ')).toBe(true);
    expect(label).toMatch(/\d{2}:\d{2}$/);
  });

  it('не показывает мусор при некорректном времени', () => {
    expect(formatTranscriptLabel(0, 'не дата')).toBe('Запись 1');
  });
});

describe('resolveSelectedTranscript', () => {
  const items = selectTranscriptItems([
    session({ session_id: 'a', created_at: '2026-09-14T09:00:00Z' }),
    session({ session_id: 'b', created_at: '2026-09-14T10:00:00Z' }),
  ]);

  it('сохраняет выбранную запись', () => {
    expect(resolveSelectedTranscript(items, 'a')?.sessionId).toBe('a');
  });

  // Врач открывает панель чаще всего ради только что закончившегося приёма.
  it('по умолчанию показывает последнюю запись', () => {
    expect(resolveSelectedTranscript(items, null)?.sessionId).toBe('b');
  });

  it('падает на последнюю, если выбранной больше нет', () => {
    expect(resolveSelectedTranscript(items, 'удалённая')?.sessionId).toBe('b');
  });

  it('возвращает null для пустого списка', () => {
    expect(resolveSelectedTranscript([], 'a')).toBeNull();
  });
});
