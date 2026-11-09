'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { usePatientDictation } from '@/hooks/usePatientDictation';
import { voiceDrag, voiceGesture } from '@/lib/voice-input';
import { formatDuration } from '@/lib/voice-recording';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  maxLength: number;
  scope?: string;
  children?: ReactNode;
}

function VoiceIcon({ kind }: { kind: 'mic' | 'stop' | 'trash' | 'lock' }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'mic' && (
        <>
          <rect x="8" y="2" width="8" height="13" rx="4" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </>
      )}
      {kind === 'stop' && (
        <rect
          x="6"
          y="6"
          width="12"
          height="12"
          rx="3"
          fill="currentColor"
          stroke="none"
        />
      )}
      {kind === 'trash' && (
        <>
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
        </>
      )}
      {kind === 'lock' && (
        <>
          <rect x="5" y="10" width="14" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
    </svg>
  );
}

export function PatientVoiceInput({ children, ...props }: Props) {
  const root = useRef<HTMLSpanElement>(null);
  const setSpeechActivity = useCallback(
    (speaking: boolean) =>
      root.current?.style.setProperty('--voice-level', speaking ? '1' : '0'),
    [],
  );
  const voice = usePatientDictation({
    ...props,
    onSpeechActivity: setSpeechActivity,
  });
  const cancelDictation = voice.cancel;
  const id = useId();
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [cancelled, setCancelled] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const recording = voice.phase !== 'idle';
  const visual = recording || cancelled;
  const microphone =
    voice.available && (visual || !children || !props.value.trim());
  const resetDrag = () => {
    root.current?.style.setProperty('--voice-drag-x', '0px');
    root.current?.style.setProperty('--voice-drag-y', '0px');
    root.current?.style.setProperty('--voice-cancel', '0');
    root.current?.style.setProperty('--voice-lock', '0');
  };
  const cancel = () => {
    const width =
      root.current?.closest('.q-voice-field')?.getBoundingClientRect().width ??
      280;
    root.current?.style.setProperty(
      '--voice-delete-x',
      `${-Math.max(80, width - 76)}px`,
    );
    setCancelled(true);
    voice.cancel();
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setCancelled(false);
      resetDrag();
    }, 240);
  };
  useEffect(() => () => clearTimeout(exitTimer.current), []);
  useLayoutEffect(() => {
    if (!recording) return;
    const field = root.current?.closest('.q-voice-field');
    // Keep the native editor focused (and its keyboard open), but do not
    // let keyboard input or Enter change/send the answer under the overlay.
    const beforeInput = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const key = (event: Event) => {
      const keyboard = event as KeyboardEvent;
      if (
        keyboard.key === 'Escape' ||
        (keyboard.key === 'Enter' &&
          keyboard.target instanceof HTMLElement &&
          keyboard.target.matches('textarea, input'))
      ) {
        keyboard.preventDefault();
        keyboard.stopPropagation();
        if (keyboard.key === 'Escape') cancelDictation();
      }
    };
    field?.addEventListener('beforeinput', beforeInput, true);
    field?.addEventListener('keydown', key, true);
    return () => {
      field?.removeEventListener('beforeinput', beforeInput, true);
      field?.removeEventListener('keydown', key, true);
    };
  }, [recording, cancelDictation]);

  useLayoutEffect(() => {
    const action = root.current;
    const field = action?.closest('.q-voice-field');
    if (!action || !field) return;
    const update = () =>
      action.style.setProperty(
        '--voice-control-right',
        `${field.getBoundingClientRect().right - action.getBoundingClientRect().right}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  const startPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      props.disabled ||
      voice.phaseRef.current !== 'idle' ||
      cancelled
    )
      return;
    event.preventDefault();
    resetDrag();
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    voice.begin('holding');
  };
  const movePointer = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = pointer.current;
    if (
      !origin ||
      event.pointerId !== origin.id ||
      voice.phaseRef.current !== 'holding'
    )
      return;
    const dx = event.clientX - origin.x,
      dy = event.clientY - origin.y;
    const drag = voiceDrag(dx, dy);
    root.current?.style.setProperty('--voice-drag-x', `${drag.x}px`);
    root.current?.style.setProperty('--voice-drag-y', `${drag.y}px`);
    root.current?.style.setProperty('--voice-cancel', String(drag.cancel));
    root.current?.style.setProperty('--voice-lock', String(drag.lock));
    const gesture = voiceGesture(dx, dy);
    if (gesture === 'cancel') cancel();
    if (gesture === 'lock') {
      voice.lock();
      resetDrag();
    }
  };
  const releasePointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== pointer.current?.id) return;
    pointer.current = null;
    if (voice.phaseRef.current === 'holding') voice.stop();
    if (!cancelled) resetDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <span
      ref={root}
      className="q-voice-action"
      data-voice-recording={visual}
      data-voice-state={cancelled ? 'cancelling' : voice.phase}
      data-voice-microphone={microphone}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        if (event.key === 'Escape' && recording) {
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <span className="q-voice-panel" aria-hidden={!visual} inert={!visual}>
        <span className="q-voice-indicator" aria-hidden="true" />
        <span className="q-voice-time" aria-label="Длительность диктовки">
          {formatDuration(voice.elapsed)}
        </span>
        <span className="q-voice-instruction" role="status">
          {voice.phase === 'stopping'
            ? 'Распознаю…'
            : !voice.listening
              ? 'Ожидаю микрофон…'
              : voice.phase === 'locked'
                ? 'Запись'
                : '← Сдвиньте для отмены'}
        </span>
        <button
          type="button"
          className="q-voice-cancel-label"
          tabIndex={voice.phase === 'locked' ? 0 : -1}
          aria-hidden={voice.phase !== 'locked'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={cancel}
        >
          Отмена
        </button>
        <span className="q-voice-bin" aria-hidden="true">
          <VoiceIcon kind="trash" />
        </span>
      </span>
      <span className="q-voice-lock" aria-hidden="true">
        <span className="q-voice-lock-arrow">↑</span>
        <VoiceIcon kind="lock" />
      </span>
      {voice.available && (
        <button
          type="button"
          className="q-voice-control q-voice-mic"
          disabled={
            props.disabled ||
            voice.phase === 'stopping' ||
            !microphone ||
            cancelled
          }
          tabIndex={microphone ? 0 : -1}
          aria-hidden={!microphone}
          aria-label={
            recording ? 'Остановить диктовку' : 'Начать голосовой ввод'
          }
          aria-describedby={id}
          aria-pressed={recording}
          title={
            recording
              ? 'Остановить диктовку'
              : 'Удерживайте для голосового ввода'
          }
          onPointerDown={startPointer}
          onPointerMove={movePointer}
          onPointerUp={releasePointer}
          onMouseDown={(event) => event.preventDefault()}
          onPointerCancel={() => {
            pointer.current = null;
            if (voice.phaseRef.current === 'holding') cancel();
          }}
          onLostPointerCapture={() => {
            if (pointer.current && voice.phaseRef.current === 'holding') {
              pointer.current = null;
              cancel();
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail > 0 && suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            if (voice.phaseRef.current === 'idle' && !cancelled) {
              resetDrag();
              voice.begin('locked');
            } else if (voice.phaseRef.current === 'locked') voice.stop();
          }}
        >
          <span className="q-voice-visual" aria-hidden="true">
            <span className="q-voice-wave q-voice-wave-outer" />
            <span className="q-voice-wave q-voice-wave-inner" />
            <span className="q-voice-orb" />
            <span className="q-voice-mic-icon">
              <VoiceIcon kind="mic" />
            </span>
            <span className="q-voice-stop-icon">
              <VoiceIcon kind="stop" />
            </span>
          </span>
        </button>
      )}
      <span
        className="q-voice-send"
        aria-hidden={microphone}
        inert={microphone}
      >
        {children}
      </span>
      <span id={id} className="sr-only">
        Удерживайте микрофон. Влево — отмена, вверх — запись без удерживания.
        Enter запускает запись без удерживания; повторное нажатие останавливает.
        Escape отменяет. Речь распознаёт сервис браузера. Проверьте текст перед
        отправкой.
      </span>
      {voice.message && (
        <span className="q-voice-notice" role="status">
          {voice.message}
          <button
            type="button"
            className="q-voice-dismiss"
            onClick={voice.clearMessage}
          >
            Понятно
          </button>
        </span>
      )}
    </span>
  );
}
