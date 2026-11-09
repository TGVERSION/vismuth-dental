import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DICTATION_TIMEOUT_MS,
  recognitionConstructor,
  startDictation,
  type BrowserRecognition,
} from './browser-dictation';

class Recognition implements BrowserRecognition {
  static latest: Recognition;
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
  Recognition.latest?.onend?.();
  vi.useRealTimers();
});
const setup = () => {
  const text = vi.fn(),
    status = vi.fn();
  const session = startDictation(Recognition, text, status);
  return { text, status, session, rec: Recognition.latest };
};

describe('browser dictation', () => {
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
    const { text, status, rec } = setup();
    expect(rec.start).toHaveBeenCalledOnce();
    expect(rec.lang).toBe('ru-RU');
    expect(rec.continuous).toBe(true);
    rec.result('черновик', false);
    expect(text).not.toHaveBeenCalled();
    rec.result('Болит зуб');
    rec.result('Болит зуб');
    expect(text).toHaveBeenCalledOnce();
    expect(text).toHaveBeenCalledWith('Болит зуб');
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
    expect(text.mock.calls).toEqual([['Первая'], ['Вторая']]);
  });
  it('stop waits for the final result', () => {
    const { rec, session, text } = setup();
    session.stop();
    expect(rec.stop).toHaveBeenCalledOnce();
    rec.result('Ответ');
    expect(text).toHaveBeenCalledWith('Ответ');
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
    'no-speech',
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
  it('ends an empty session with a useful message', () => {
    const { rec, status } = setup();
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
    startDictation(Broken, vi.fn(), status);
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
      false,
    );
    class BrokenStart extends Recognition {
      start = vi.fn(() => {
        throw Error('failure');
      });
    }
    startDictation(BrokenStart, vi.fn(), status);
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
