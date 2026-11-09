import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DICTATION_TIMEOUT_MS,
  DICTATION_RESTART_MS,
  recognitionConstructor,
  startDictation,
  type BrowserRecognition,
} from './browser-dictation';

class Recognition implements BrowserRecognition {
  static latest: Recognition;
  static session: ReturnType<typeof startDictation>;
  lang = '';
  continuous = true;
  interimResults = false;
  onstart: BrowserRecognition['onstart'] = null;
  onresult: BrowserRecognition['onresult'] = null;
  onerror: BrowserRecognition['onerror'] = null;
  onend: BrowserRecognition['onend'] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    Recognition.latest = this;
  }
  result(text: string, isFinal = true) {
    this.onresult?.({ results: [{ isFinal, 0: { transcript: text } }] });
  }
}

afterEach(() => {
  Recognition.session?.cancel();
  vi.useRealTimers();
});
const setup = () => {
  const text = vi.fn(),
    status = vi.fn();
  const session = startDictation(Recognition, text, status);
  Recognition.session = session;
  return { text, status, session, rec: Recognition.latest };
};

describe('browser dictation', () => {
  it('continues after a silence end without completing the recording', () => {
    vi.useFakeTimers();
    const { rec, text, status, session } = setup();
    rec.result('Первая мысль');
    const staleResult = rec.onresult,
      staleEnd = rec.onend;
    rec.onend?.();
    expect(status).toHaveBeenLastCalledWith(expect.any(String), true);
    vi.advanceTimersByTime(DICTATION_RESTART_MS);
    const next = Recognition.latest;
    expect(next).not.toBe(rec);
    next.result('После паузы');
    next.result('После паузы');
    staleResult?.({
      results: [{ isFinal: true, 0: { transcript: 'Не вставлять' } }],
    });
    staleEnd?.();
    session.stop();
    next.onend?.();
    expect(text).toHaveBeenLastCalledWith('Первая мысль После паузы');
    expect(status).toHaveBeenLastCalledWith(expect.any(String), false);
  });

  it('restarts after no-speech but backs off empty runs', () => {
    vi.useFakeTimers();
    const { rec, session, status } = setup();
    rec.onerror?.({ error: 'no-speech' });
    rec.onend?.();
    vi.advanceTimersByTime(999);
    expect(Recognition.latest).toBe(rec);
    vi.advanceTimersByTime(1);
    expect(Recognition.latest).not.toBe(rec);
    expect(status).toHaveBeenLastCalledWith(expect.any(String), true);
    session.cancel();
  });

  it.each(['stop', 'cancel'] as const)(
    'does not restart after %s during a pause',
    (action) => {
      vi.useFakeTimers();
      const { rec, session, status } = setup();
      rec.result('Сохранённый фрагмент');
      rec.onend?.();
      session[action]();
      vi.advanceTimersByTime(2000);
      expect(Recognition.latest).toBe(rec);
      expect(status).toHaveBeenLastCalledWith(expect.any(String), false);
    },
  );

  it('preserves real repetitions across separate browser runs', () => {
    vi.useFakeTimers();
    const { rec, session, text } = setup();
    rec.result('да');
    rec.onend?.();
    vi.advanceTimersByTime(DICTATION_RESTART_MS);
    const next = Recognition.latest;
    next.result('да');
    session.stop();
    next.onend?.();
    expect(text).toHaveBeenLastCalledWith('да да');
  });

  it('keeps one overall deadline across restarts', () => {
    vi.useFakeTimers();
    const { rec, status } = setup();
    vi.advanceTimersByTime(30_000);
    rec.result('До паузы');
    rec.onend?.();
    vi.advanceTimersByTime(DICTATION_RESTART_MS);
    const next = Recognition.latest;
    vi.advanceTimersByTime(30_000 - DICTATION_RESTART_MS);
    expect(next.abort).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('времени'),
      false,
    );
    vi.advanceTimersByTime(5000);
    expect(Recognition.latest).toBe(next);
  });

  it('retains unconfirmed-tail warning across subsequent runs', () => {
    vi.useFakeTimers();
    const { rec, session, text, status } = setup();
    rec.result('Первый фрагмент', false);
    rec.onend?.();
    vi.advanceTimersByTime(DICTATION_RESTART_MS);
    const next = Recognition.latest;
    next.result('продолжение');
    session.stop();
    next.onend?.();
    expect(text).toHaveBeenLastCalledWith('Первый фрагмент продолжение');
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('не подтверждены'),
      false,
    );
  });
  it('animates speech activity from the recognizer and clears it after cancel', () => {
    const activity = vi.fn();
    const session = startDictation(Recognition, vi.fn(), vi.fn(), activity);
    const rec: BrowserRecognition = Recognition.latest;
    rec.onspeechstart?.();
    expect(activity).toHaveBeenLastCalledWith(true);
    rec.onspeechend?.();
    expect(activity).toHaveBeenLastCalledWith(false);
    const late = rec.onspeechstart;
    session.cancel();
    late?.();
    expect(activity).toHaveBeenLastCalledWith(false);
  });
  it('selects prefixed API only in a secure context', () => {
    expect(
      recognitionConstructor({
        isSecureContext: false,
        SpeechRecognition: Recognition,
      }),
    ).toBeUndefined();
    expect(recognitionConstructor({ isSecureContext: true })).toBeUndefined();
    expect(
      recognitionConstructor({
        isSecureContext: true,
        webkitSpeechRecognition: Recognition,
      }),
    ).toBe(Recognition);
  });
  it('starts synchronously in Russian, keeps interim separate and avoids repeated finals', () => {
    const { text, status, rec, session } = setup();
    expect(rec.start).toHaveBeenCalledOnce();
    expect(rec.lang).toBe('ru-RU');
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(false);
    rec.result('черновик', false);
    expect(text).not.toHaveBeenCalled();
    rec.result('Болит зуб');
    rec.result('Болит зуб');
    expect(text).toHaveBeenCalledOnce();
    expect(text).toHaveBeenCalledWith('Болит зуб');
    session.stop();
    rec.onend?.();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('Проверьте'),
      false,
    );
  });
  it('commits multiple final results only once', () => {
    const { rec, text } = setup();
    rec.result('Первая');
    rec.onresult?.({
      results: [
        { isFinal: true, 0: { transcript: 'Первая' } },
        { isFinal: true, 0: { transcript: 'Вторая' } },
      ],
    });
    expect(text.mock.calls).toEqual([['Первая'], ['Первая Вторая']]);
  });
  it('stop waits for the final result', () => {
    const { rec, session, text } = setup();
    session.stop();
    expect(rec.stop).toHaveBeenCalledOnce();
    rec.result('Ответ');
    expect(text).toHaveBeenCalledWith('Ответ');
  });

  it('replaces corrected snapshots at the same index instead of retaining the first word', () => {
    const { rec, text } = setup();
    rec.result('верхние');
    rec.result('верхние квадрат');
    rec.result('верхние квадрат ничего не болит');
    rec.result(
      'верхние квадрат ничего не болит Нижний иногда побаливает где-то 3 месяца назад',
    );
    rec.onend?.();
    expect(text).toHaveBeenLastCalledWith(
      'верхние квадрат ничего не болит Нижний иногда побаливает где-то 3 месяца назад',
    );
  });

  it('does not request Android cumulative partials from the reported example', () => {
    class AndroidRecognition extends Recognition {
      start = vi.fn(() => {
        const prefixes = [
          'верхние',
          'верхние',
          'верхние квадрат',
          'верхние квадрат ничего',
          'верхние квадрат ничего не болит',
        ];
        // Android maps requested partials to separate final entries in continuous mode.
        if (this.interimResults)
          this.onresult?.({
            results: prefixes.map((transcript) => ({
              isFinal: true,
              0: { transcript },
            })),
          });
        this.result(
          'верхние квадрат ничего не болит Нижний иногда побаливает где-то 3 месяца назад',
        );
      });
    }
    const text = vi.fn();
    Recognition.session = startDictation(AndroidRecognition, text, vi.fn());
    expect(text).toHaveBeenCalledOnce();
    expect(text).toHaveBeenLastCalledWith(
      'верхние квадрат ничего не болит Нижний иногда побаливает где-то 3 месяца назад',
    );
  });

  it('keeps intentional repeated words and separate repeated phrases', () => {
    const { rec, text } = setup();
    rec.onresult?.({
      results: [
        { isFinal: true, 0: { transcript: 'да да' } },
        { isFinal: true, 0: { transcript: 'да да' } },
      ],
    });
    expect(text).toHaveBeenLastCalledWith('да да да да');
  });

  it('retains an unconfirmed tail with a warning if the provider never finalises it', () => {
    const { rec, text, status, session } = setup();
    rec.onresult?.({
      results: [
        { isFinal: true, 0: { transcript: 'Болит' } },
        { isFinal: false, 0: { transcript: 'три месяца' } },
      ],
    });
    session.stop();
    rec.onend?.();
    expect(text).toHaveBeenLastCalledWith('Болит три месяца');
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('не подтверждены'),
      false,
    );
  });

  it('uses the last final correction, including a shorter phrase', () => {
    const { rec, text, session } = setup();
    rec.result('Болит зуб и десна', false);
    session.stop();
    rec.result('Болит зуб');
    rec.onend?.();
    expect(text).toHaveBeenLastCalledWith('Болит зуб');
  });

  it('removes withdrawn interim words and replaces the previous snapshot', () => {
    const { rec, text } = setup();
    rec.result('Первый ответ');
    rec.onresult?.({
      results: [
        { isFinal: true, 0: { transcript: 'Первый ответ' } },
        { isFinal: false, 0: { transcript: 'лишний хвост' } },
      ],
    });
    rec.result('Исправленный ответ');
    rec.onend?.();
    expect(text).toHaveBeenLastCalledWith('Исправленный ответ');
  });

  it('does not commit interim words when cancelled', () => {
    const { rec, text, session } = setup();
    rec.result('Не сохранять', false);
    session.cancel();
    expect(text).not.toHaveBeenCalled();
  });

  it('releases the microphone when the browser ignores stop', () => {
    vi.useFakeTimers();
    const { rec, session, status } = setup();
    rec.result('Ответ');
    session.stop();
    vi.advanceTimersByTime(5000);
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('Проверьте'),
      false,
    );
  });
  it('cancels the preceding field and ignores already queued events', () => {
    const first = setup();
    const stale = first.rec.onresult;
    const second = setup();
    expect(first.rec.abort).toHaveBeenCalledOnce();
    stale?.({
      results: [{ isFinal: true, 0: { transcript: 'Поздний ответ' } }],
    });
    expect(first.text).not.toHaveBeenCalled();
    second.session.cancel();
  });
  it.each([
    'not-allowed',
    'network',
    'audio-capture',
    'service-not-allowed',
    'unknown',
    'aborted',
  ])('recovers from %s without accepting late text', (error) => {
    const { rec, text, status } = setup();
    rec.onerror?.({ error });
    rec.result('Не добавлять');
    expect(text).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith(expect.any(String), false);
    expect(rec.abort).toHaveBeenCalledOnce();
  });
  it('ends an explicitly stopped empty session with a useful message', () => {
    const { rec, status, session } = setup();
    session.stop();
    rec.onend?.();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('услышать'),
      false,
    );
  });
  it('times out and releases the microphone', () => {
    vi.useFakeTimers();
    const { rec, status } = setup();
    vi.advanceTimersByTime(DICTATION_TIMEOUT_MS);
    expect(rec.abort).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('времени'),
      false,
    );
  });
  it('handles constructor and start failures', () => {
    class Broken extends Recognition {
      constructor() {
        super();
        throw Error('failure');
      }
    }
    const status = vi.fn();
    Recognition.session = startDictation(Broken, vi.fn(), status);
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
      false,
    );
    class BrokenStart extends Recognition {
      start = vi.fn(() => {
        throw Error('failure');
      });
    }
    Recognition.session = startDictation(BrokenStart, vi.fn(), status);
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
      false,
    );
  });
  it('does not overwrite status when a consumer cancels a rejected result', () => {
    const status = vi.fn();
    const session = startDictation(Recognition, () => session.cancel(), status);
    Recognition.latest.result('Слишком длинный');
    expect(status).toHaveBeenLastCalledWith('', false);
  });
});
