import { describe, it, expect } from 'vitest';
import {
  describeMissedFailures,
  describeRecognitionFailure,
  pickUnreportedFailures,
  rememberAcknowledged,
  shortenServerError,
} from './transcription-errors';
import type { SpeechSessionStatus } from '@/api';

const session = (
  overrides: Partial<SpeechSessionStatus>,
): SpeechSessionStatus => ({
  session_id: 'session',
  protocol_id: 'protocol',
  status: 'error',
  created_at: null,
  progress: 1,
  transcript: null,
  field_values: null,
  error: null,
  ...overrides,
});

describe('describeRecognitionFailure', () => {
  it('показывает причину от сервера', () => {
    expect(describeRecognitionFailure('слишком тихая запись')).toBe(
      'Расшифровка не выполнена: слишком тихая запись',
    );
  });

  it('обходится общим текстом, если причины нет', () => {
    expect(describeRecognitionFailure(null)).toBe('Расшифровка не выполнена.');
    expect(describeRecognitionFailure('   ')).toBe('Расшифровка не выполнена.');
  });
});

describe('shortenServerError', () => {
  // Длинный ответ сервера не должен растягивать уведомление на пол-экрана.
  it('обрезает слишком длинную причину', () => {
    const shortened = shortenServerError('а'.repeat(500));

    expect(shortened?.length).toBe(201);
    expect(shortened?.endsWith('…')).toBe(true);
  });

  it('не трогает короткую причину', () => {
    expect(shortenServerError('  нет сигнала  ')).toBe('нет сигнала');
  });
});

describe('pickUnreportedFailures', () => {
  it('выбирает только сбои, о которых ещё не сообщали', () => {
    const failures = pickUnreportedFailures(
      [
        session({ session_id: 'новый сбой' }),
        session({ session_id: 'показанный сбой' }),
        session({ session_id: 'готовая', status: 'done' }),
        session({ session_id: 'в обработке', status: 'processing' }),
      ],
      ['показанный сбой'],
    );

    expect(failures.map((item) => item.session_id)).toEqual(['новый сбой']);
  });
});

describe('describeMissedFailures', () => {
  it('молчит, если сбоев нет', () => {
    expect(describeMissedFailures([])).toBeNull();
  });

  it('называет причину единственного сбоя', () => {
    expect(describeMissedFailures([session({ error: 'обрыв связи' })])).toBe(
      'Запись приёма не распознана: обрыв связи',
    );
  });

  it('для нескольких сбоев отправляет в панель', () => {
    const message = describeMissedFailures([
      session({ session_id: 'a' }),
      session({ session_id: 'b' }),
    ]);

    expect(message).toContain('Не распознано записей приёма: 2');
    expect(message).toContain('Расшифровка приёма');
  });
});

describe('rememberAcknowledged', () => {
  it('добавляет новые без повторов', () => {
    expect(rememberAcknowledged(['a', 'b'], ['b', 'c', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  // Иначе хранилище росло бы бесконечно.
  it('помнит только последние 50', () => {
    const current = Array.from({ length: 50 }, (_, index) => `old-${index}`);
    const remembered = rememberAcknowledged(current, ['new']);

    expect(remembered).toHaveLength(50);
    expect(remembered[0]).toBe('old-1');
    expect(remembered[49]).toBe('new');
  });
});
