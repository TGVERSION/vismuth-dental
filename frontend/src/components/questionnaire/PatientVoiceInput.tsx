'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  recognitionConstructor,
  startDictation,
  type SpeechWindow,
} from '@/lib/browser-dictation';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  maxLength: number;
  scope?: string;
}

const subscribe = () => () => {};
const isAvailable = () =>
  Boolean(recognitionConstructor(window as unknown as SpeechWindow));
const serverAvailable = () => false;

export function PatientVoiceInput({
  value,
  onChange,
  disabled,
  maxLength,
  scope,
}: Props) {
  const available = useSyncExternalStore(
    subscribe,
    isAvailable,
    serverAvailable,
  );
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const id = useId();
  const current = useRef({ value, onChange, disabled, maxLength, scope });
  useLayoutEffect(() => {
    current.current = { value, onChange, disabled, maxLength, scope };
  });
  const session = useRef<ReturnType<typeof startDictation> | null>(null);

  useEffect(() => {
    const cancel = () => session.current?.cancel();
    const hide = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      cancel();
      window.removeEventListener('pagehide', cancel);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  useEffect(() => {
    session.current?.cancel();
  }, [disabled, scope]);

  if (!available) return null;
  const start = () => {
    if (disabled) return;
    if (active) {
      session.current?.stop();
      return;
    }
    const Recognition = recognitionConstructor(
      window as unknown as SpeechWindow,
    );
    if (!Recognition) return;
    const startedScope = scope;
    session.current = startDictation(
      Recognition,
      (text) => {
        const latest = current.current;
        if (latest.disabled || latest.scope !== startedScope) return;
        const next = `${latest.value}${latest.value && !/\s$/.test(latest.value) ? ' ' : ''}${text}`;
        // Never silently discard a medical answer when the field is full.
        if (next.length > latest.maxLength) {
          session.current?.cancel();
          setMessage(
            `Текст не добавлен: предел ${latest.maxLength} символов. Сократите ответ или продиктуйте короче.`,
          );
          return;
        }
        current.current = { ...latest, value: next };
        latest.onChange(next);
      },
      (status, listening) => {
        setMessage(status);
        setActive(listening);
      },
    );
  };
  return (
    <div className="my-2 min-w-0 text-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={start}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.stopPropagation();
        }}
        aria-pressed={active}
        aria-describedby={id}
        className="min-h-[44px] rounded-xl px-3 text-[var(--q-brand)] outline-offset-2 focus-visible:outline-2 disabled:opacity-40"
      >
        {active ? 'Остановить диктовку' : 'Голосом'}
      </button>
      <p id={id} className="text-xs text-[var(--q-muted)]">
        Речь распознаёт сервис браузера. Проверьте текст перед отправкой.
      </p>
      <p
        role="status"
        aria-live="polite"
        className="break-words text-[var(--q-muted)]"
      >
        {message}
      </p>
    </div>
  );
}
