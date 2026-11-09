export const VOICE_CANCEL_DISTANCE = 80;
export const VOICE_LOCK_DISTANCE = 64;

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
