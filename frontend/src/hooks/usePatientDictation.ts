'use client';

import {
  useCallback,
  useEffect,
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
import { appendDictation } from '@/lib/voice-input';

interface Props {
  value: string;
  onChange: (text: string) => void;
  maxLength: number;
  disabled: boolean;
  scope?: string;
}
type Phase = 'idle' | 'holding' | 'locked' | 'stopping';
const subscribe = () => () => {};
const supported = () =>
  Boolean(recognitionConstructor(window as unknown as SpeechWindow));
const serverSupported = () => false;

export function usePatientDictation(props: Props) {
  const available = useSyncExternalStore(subscribe, supported, serverSupported);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [listening, setListening] = useState(false);
  const current = useRef(props);
  const phaseRef = useRef<Phase>('idle');
  const session = useRef<ReturnType<typeof startDictation> | null>(null);
  const startedAt = useRef<number | null>(null);
  const attempt = useRef<{
    scope?: string;
    text: string;
    discarded: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    current.current = props;
  });
  const transition = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const cancel = useCallback(() => {
    if (attempt.current) attempt.current.discarded = true;
    session.current?.cancel();
    transition('idle');
    setListening(false);
    setMessage('');
  }, [transition]);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('pagehide', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      if (attempt.current) attempt.current.discarded = true;
      session.current?.cancel();
      window.removeEventListener('pagehide', cancel);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancel]);
  useEffect(() => () => cancel(), [props.scope, props.disabled, cancel]);
  useEffect(() => {
    if (phase === 'idle') return;
    const timer = setInterval(() => {
      if (startedAt.current !== null)
        setElapsed(Date.now() - startedAt.current);
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  const begin = (mode: 'holding' | 'locked') => {
    if (current.current.disabled || phaseRef.current !== 'idle') return;
    const Recognition = recognitionConstructor(
      window as unknown as SpeechWindow,
    );
    if (!Recognition) return;
    const recording = {
      scope: current.current.scope,
      text: '',
      discarded: false,
    };
    attempt.current = recording;
    startedAt.current = null;
    setElapsed(0);
    setListening(false);
    setMessage('');
    transition(mode);
    session.current = startDictation(
      Recognition,
      (text) => {
        if (!recording.discarded)
          recording.text += `${recording.text ? ' ' : ''}${text}`;
      },
      (status, active) => {
        if (attempt.current !== recording) return;
        if (active) {
          if (status !== 'Ожидаю микрофон…' && startedAt.current === null) {
            startedAt.current = Date.now();
            setListening(true);
          }
          return;
        }
        transition('idle');
        setListening(false);
        const latest = current.current;
        if (
          !status ||
          recording.discarded ||
          latest.disabled ||
          latest.scope !== recording.scope
        )
          return;
        if (!recording.text.trim()) {
          setMessage(status);
          return;
        }
        const next = appendDictation(
          latest.value,
          recording.text,
          latest.maxLength,
        );
        if (next === null) {
          setMessage(
            `Текст не добавлен: предел ${latest.maxLength} символов. Сократите ответ или продиктуйте короче.`,
          );
          return;
        }
        current.current = { ...latest, value: next };
        latest.onChange(next);
        setMessage(status.startsWith('Текст добавлен.') ? '' : status);
      },
    );
  };
  const stop = () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'stopping') return;
    transition('stopping');
    session.current?.stop();
  };
  const lock = () => {
    if (phaseRef.current === 'holding') transition('locked');
  };
  return {
    available,
    phase,
    phaseRef,
    listening,
    elapsed,
    message,
    clearMessage: () => setMessage(''),
    begin,
    cancel,
    lock,
    stop,
  };
}
