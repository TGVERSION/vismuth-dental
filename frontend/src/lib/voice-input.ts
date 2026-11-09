export const VOICE_CANCEL_DISTANCE = 80;
export const VOICE_LOCK_DISTANCE = 64;

export function voiceDrag(dx: number, dy: number) {
  const x = Math.max(-VOICE_CANCEL_DISTANCE, Math.min(0, dx));
  const y = Math.max(-VOICE_LOCK_DISTANCE, Math.min(0, dy));
  return {
    x:
      Math.abs(x) / VOICE_CANCEL_DISTANCE >= Math.abs(y) / VOICE_LOCK_DISTANCE
        ? x
        : 0,
    y:
      Math.abs(y) / VOICE_LOCK_DISTANCE > Math.abs(x) / VOICE_CANCEL_DISTANCE
        ? y
        : 0,
    cancel: Math.abs(x) / VOICE_CANCEL_DISTANCE,
    lock: Math.abs(y) / VOICE_LOCK_DISTANCE,
  };
}

export function voiceGesture(dx: number, dy: number): 'cancel' | 'lock' | null {
  if (
    -dx >= VOICE_CANCEL_DISTANCE &&
    -dx / VOICE_CANCEL_DISTANCE >= -dy / VOICE_LOCK_DISTANCE
  )
    return 'cancel';
  if (-dy >= VOICE_LOCK_DISTANCE) return 'lock';
  return null;
}

/** A cancelled recording never calls this; overflow preserves the whole draft. */
export function appendDictation(
  value: string,
  text: string,
  maxLength: number,
): string | null {
  const phrase = text.trim();
  if (!phrase) return value;
  const next = `${value}${value && !/\s$/.test(value) ? ' ' : ''}${phrase}`;
  return next.length <= maxLength ? next : null;
}
