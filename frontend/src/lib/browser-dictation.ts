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

export const DICTATION_RESTART_MS = 200;
const EMPTY_RESTART_MS = 1000;
const FINAL_WAIT_MS = 5000;

/** One user recording may contain several browser runs, separated by silence. */
export function startDictation(
  Recognition: RecognitionConstructor,
  onText: (text: string) => void,
  onStatus: (message: string, active: boolean) => void,
  onSpeechActivity?: (speaking: boolean) => void,
) {
  cancelActive?.();
  let rec: BrowserRecognition | undefined;
  let closed = false,
    stopping = false;
  let prefix = '',
    current = '',
    published = '';
  let prefixInterim = false,
    currentInterim = false;
  let restart: ReturnType<typeof setTimeout> | undefined;
  let finalWait: ReturnType<typeof setTimeout> | undefined;
  const transcript = () => [prefix, current].filter(Boolean).join(' ');
  const publish = () => {
    const next = transcript();
    if (next === published) return;
    published = next;
    onText(next);
  };
  const completedMessage = () =>
    (prefixInterim || currentInterim) && transcript()
      ? 'Последние слова не подтверждены сервисом. Проверьте расшифровку перед отправкой.'
      : transcript()
        ? 'Текст добавлен. Проверьте ответ перед отправкой.'
        : ERRORS['no-speech'];
  const detach = (recognition: BrowserRecognition) => {
    recognition.onstart =
      recognition.onresult =
      recognition.onerror =
      recognition.onend =
        null;
    recognition.onspeechstart = recognition.onspeechend = null;
  };
  const finish = (message: string, abort = false) => {
    if (closed) return;
    if (message) publish();
    if (closed) return;
    closed = true;
    clearTimeout(deadline);
    clearTimeout(restart);
    clearTimeout(finalWait);
    if (cancelActive === cancel) cancelActive = undefined;
    if (rec) {
      detach(rec);
      if (abort) {
        try {
          rec.abort();
        } catch {
          /* Already ended. */
        }
      }
      rec = undefined;
    }
    onSpeechActivity?.(false);
    onStatus(message, false);
  };
  const cancel = () => finish('', true);
  const stop = () => {
    if (closed || stopping) return;
    stopping = true;
    clearTimeout(restart);
    clearTimeout(deadline);
    onStatus('Завершаю распознавание…', true);
    if (!rec) {
      finish(completedMessage());
      return;
    }
    finalWait = setTimeout(
      () => finish(completedMessage(), true),
      FINAL_WAIT_MS,
    );
    try {
      rec.stop();
    } catch {
      finish('Диктовка остановлена.', true);
    }
  };
  const startRun = () => {
    restart = undefined;
    if (closed || stopping) return;
    try {
      const run = new Recognition();
      rec = run;
      current = '';
      currentInterim = false;
      const active = () => !closed && rec === run;
      run.lang = 'ru-RU';
      run.continuous = true;
      // Android can mark cumulative partial hypotheses as separate final results.
      run.interimResults = false;
      run.onstart = () => {
        if (active()) onStatus('Слушаю. Говорите.', true);
      };
      run.onspeechstart = () => {
        if (active()) onSpeechActivity?.(true);
      };
      run.onspeechend = () => {
        if (active()) onSpeechActivity?.(false);
      };
      run.onresult = ({ results }) => {
        if (!active()) return;
        const final: string[] = [],
          interim: string[] = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          (result.isFinal ? final : interim).push(
            result[0]?.transcript?.trim() ?? '',
          );
        }
        current = [...final, ...interim].filter(Boolean).join(' ');
        currentInterim = interim.some(Boolean);
        if (!currentInterim) publish();
        if (active())
          onStatus(
            stopping ? 'Завершаю распознавание…' : 'Слушаю. Говорите.',
            true,
          );
      };
      run.onerror = ({ error }) => {
        if (!active()) return;
        // Silence is an end of a browser run, not the user's recording.
        if (error === 'no-speech') {
          onSpeechActivity?.(false);
          return;
        }
        finish(
          error === 'aborted'
            ? 'Диктовка остановлена.'
            : (ERRORS[error] ??
                'Не удалось распознать речь. Введите ответ текстом.'),
          true,
        );
      };
      run.onend = () => {
        if (!active()) return;
        detach(run);
        rec = undefined;
        onSpeechActivity?.(false);
        if (stopping) {
          finish(completedMessage());
          return;
        }
        const hadText = Boolean(current);
        prefix = transcript();
        prefixInterim = prefixInterim || currentInterim;
        current = '';
        currentInterim = false;
        publish();
        if (closed || stopping) return;
        onStatus('Слушаю. Можно продолжать после паузы.', true);
        restart = setTimeout(
          startRun,
          hadText ? DICTATION_RESTART_MS : EMPTY_RESTART_MS,
        );
      };
      onStatus('Ожидаю микрофон…', true);
      run.start();
    } catch {
      finish(
        'Не удалось запустить диктовку. Попробуйте ещё раз или введите ответ текстом.',
        true,
      );
    }
  };
  cancelActive = cancel;
  const deadline = setTimeout(
    () =>
      finish('Диктовка завершена по времени. Можно запустить ещё раз.', true),
    DICTATION_TIMEOUT_MS,
  );
  startRun();
  return { cancel, stop };
}
