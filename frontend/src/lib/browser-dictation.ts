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
  let transcript = '';
  let hasInterim = false;
  let published = '';
  let stopping = false;
  const publish = () => {
    if (transcript === published) return;
    published = transcript;
    onText(transcript);
  };
  const completedMessage = () =>
    hasInterim && transcript
      ? 'Последние слова не подтверждены сервисом. Проверьте расшифровку перед отправкой.'
      : transcript
        ? 'Текст добавлен. Проверьте ответ перед отправкой.'
        : ERRORS['no-speech'];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (message: string, abort = false) => {
    if (closed) return;
    // Cancel never publishes; other exits retain the latest draft for review.
    if (message) publish();
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
    // Android continuous mode can label cumulative partials as final.
    // The recording panel does not display partial words, so do not request them.
    rec.interimResults = false;
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
        const phrase = result[0]?.transcript?.trim() ?? '';
        (result.isFinal ? final : interim).push(phrase);
      }
      transcript = [...final, ...interim].filter(Boolean).join(' ');
      hasInterim = interim.some(Boolean);
      // The callback replaces the whole draft, never appends an event delta.
      if (!hasInterim) publish();
      if (closed) return;
      onStatus(
        stopping ? 'Завершаю распознавание…' : 'Слушаю. Говорите.',
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
    rec.onend = () => finish(completedMessage());
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
      if (closed || stopping) return;
      stopping = true;
      onStatus('Завершаю распознавание…', true);
      clearTimeout(timer);
      timer = setTimeout(() => finish(completedMessage(), true), 5000);
      try {
        rec?.stop();
      } catch {
        finish('Диктовка остановлена.', true);
      }
    },
  };
}
