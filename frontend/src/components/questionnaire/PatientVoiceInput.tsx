'use client';

import { useId, useRef, type ReactNode, type PointerEvent } from 'react';
import { usePatientDictation } from '@/hooks/usePatientDictation';
import { voiceGesture } from '@/lib/voice-input';
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
  const voice = usePatientDictation(props);
  const id = useId();
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const recording = voice.phase !== 'idle';
  const microphone =
    voice.available && (recording || !children || !props.value.trim());
  const startPointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      props.disabled ||
      voice.phaseRef.current !== 'idle'
    )
      return;
    event.preventDefault();
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
    const gesture = voiceGesture(
      event.clientX - origin.x,
      event.clientY - origin.y,
    );
    if (gesture === 'cancel') voice.cancel();
    if (gesture === 'lock') voice.lock();
  };
  const releasePointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== pointer.current?.id) return;
    pointer.current = null;
    if (voice.phaseRef.current === 'holding') voice.stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <span
      className={recording ? 'q-voice-session' : 'q-voice-action'}
      data-voice-recording={recording}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        if (event.key === 'Escape' && recording) {
          event.stopPropagation();
          voice.cancel();
        }
      }}
    >
      {recording && (
        <>
          {voice.phase === 'locked' ? (
            <button
              type="button"
              className="q-voice-control q-voice-delete"
              aria-label="Отменить диктовку"
              onClick={voice.cancel}
            >
              <VoiceIcon kind="trash" />
            </button>
          ) : null}
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
          {voice.phase === 'holding' && (
            <span className="q-voice-lock" aria-hidden="true">
              <span>↑</span>
              <VoiceIcon kind="lock" />
            </span>
          )}
        </>
      )}
      {microphone ? (
        <button
          type="button"
          className={
            recording
              ? 'q-voice-control q-voice-mic q-voice-mic-active bg-[var(--q-brand)]'
              : 'q-voice-control q-voice-mic'
          }
          disabled={props.disabled || voice.phase === 'stopping'}
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
          onPointerCancel={() => {
            pointer.current = null;
            if (voice.phaseRef.current === 'holding') voice.cancel();
          }}
          onLostPointerCapture={() => {
            if (pointer.current && voice.phaseRef.current === 'holding') {
              pointer.current = null;
              voice.cancel();
            }
          }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail > 0 && suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            if (voice.phaseRef.current === 'idle') voice.begin('locked');
            else if (voice.phaseRef.current === 'locked') voice.stop();
          }}
        >
          <VoiceIcon
            kind={recording && voice.phase !== 'holding' ? 'stop' : 'mic'}
          />
        </button>
      ) : (
        children
      )}
      <span id={id} className="sr-only">
        Удерживайте микрофон. Влево — отмена, вверх — запись без удерживания. С
        клавиатуры нажмите Enter, затем ещё раз для остановки. Escape отменяет
        запись. Речь распознаёт сервис браузера; проверьте текст перед
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
