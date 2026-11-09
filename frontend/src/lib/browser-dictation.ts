export interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognitionConstructor = new () => BrowserRecognition;
export type SpeechWindow = {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
  isSecureContext: boolean;
};
export const recognitionConstructor = (browser: SpeechWindow) =>
  browser.isSecureContext
    ? (browser.SpeechRecognition ?? browser.webkitSpeechRecognition)
    : undefined;

const ERRORS: Record<string, string> = {
  'not-allowed':
    'Разрешите доступ к микрофону в настройках браузера или введите ответ текстом.',
  'service-not-allowed':
    'Сервис диктовки недоступен в этом браузере. Введите ответ текстом.',
  network:
    'Нет связи с сервисом распознавания. Попробуйте ещё раз или введите ответ текстом.',
  'audio-capture': 'Микрофон недоступен. Проверьте его разрешения.',
  'no-speech': 'Не удалось услышать речь. Попробуйте ещё раз.',
  'language-not-supported':
    'Браузер не поддерживает диктовку на русском языке.',
};

let cancelActive: (() => void) | undefined;
export const DICTATION_TIMEOUT_MS = 60_000;

/** A user gesture starts dictation; the caller buffers final phrases until Stop. */
export function startDictation(
  Recognition: RecognitionConstructor,
  onText: (text: string) => void,
  onStatus: (message: string, active: boolean) => void,
  onSpeechActivity?: (speaking: boolean) => void,
) {
  cancelActive?.();
  let rec: BrowserRecognition | undefined;
  let closed = false;
  let received = false;
  const committed = new Set<number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (message: string, abort = false) => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    if (cancelActive === cancel) cancelActive = undefined;
    if (rec) {
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      rec.onspeechstart = rec.onspeechend = null;
      if (abort) {
        try {
          rec.abort();
        } catch {
          /* Already ended in the browser. */
        }
      }
    }
    onSpeechActivity?.(false);
    onStatus(message, false);
  };
  const cancel = () => finish('', true);
  cancelActive = cancel;
  try {
    rec = new Recognition();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      if (!closed) onStatus('Слушаю. Говорите.', true);
    };
    rec.onspeechstart = () => {
      if (!closed) onSpeechActivity?.(true);
    };
    rec.onspeechend = () => {
      if (!closed) onSpeechActivity?.(false);
    };
    rec.onresult = ({ results }) => {
      if (closed) return;
      const final: string[] = [],
        interim: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal && !committed.has(i)) {
          committed.add(i);
          final.push(result[0].transcript.trim());
        } else if (!result.isFinal) interim.push(result[0].transcript);
      }
      const text = final.filter(Boolean).join(' ');
      if (text) {
        received = true;
        onText(text);
      }
      if (closed) return;
      onStatus(
        interim.length
          ? `Распознаю: ${interim.join(' ')}`
          : 'Текст добавлен. Можно продолжать говорить или остановить.',
        true,
      );
    };
    rec.onerror = ({ error }) =>
      finish(
        error === 'aborted'
          ? 'Диктовка остановлена.'
          : (ERRORS[error] ??
              'Не удалось распознать речь. Введите ответ текстом.'),
        true,
      );
    rec.onend = () =>
      finish(
        received
          ? 'Текст добавлен. Проверьте ответ перед отправкой.'
          : ERRORS['no-speech'],
      );
    onStatus('Ожидаю микрофон…', true);
    rec.start();
    if (!closed)
      timer = setTimeout(
        () =>
          finish(
            'Диктовка завершена по времени. Можно запустить ещё раз.',
            true,
          ),
        DICTATION_TIMEOUT_MS,
      );
  } catch {
    finish(
      'Не удалось запустить диктовку. Попробуйте ещё раз или введите ответ текстом.',
      true,
    );
  }
  return {
    cancel,
    stop: () => {
      if (closed) return;
      onStatus('Завершаю распознавание…', true);
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          finish(
            received
              ? 'Текст добавлен. Проверьте ответ перед отправкой.'
              : ERRORS['no-speech'],
            true,
          ),
        5000,
      );
      try {
        rec?.stop();
      } catch {
        finish('Диктовка остановлена.', true);
      }
    },
  };
}
