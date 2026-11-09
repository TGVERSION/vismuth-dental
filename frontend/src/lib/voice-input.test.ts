import { describe, expect, it } from 'vitest';
import { appendDictation, voiceDrag, voiceGesture } from './voice-input';

describe('recording gestures', () => {
  it('moves the animation progressively before a gesture completes', () => {
    expect(voiceDrag(-40, 0)).toEqual({ x: -40, y: 0, cancel: 0.5, lock: 0 });
    expect(voiceDrag(0, -32)).toEqual({ x: 0, y: -32, cancel: 0, lock: 0.5 });
    expect(voiceDrag(100, 100)).toEqual({ x: 0, y: 0, cancel: 0, lock: 0 });
  });
  it('clamps animation movement and follows the dominant direction', () => {
    expect(voiceDrag(-200, -10).x).toBe(-80);
    expect(voiceDrag(-10, -200).y).toBe(-64);
  });
  it('ignores small movements and dragging down or right', () => {
    expect(voiceGesture(-40, -20)).toBeNull();
    expect(voiceGesture(100, 100)).toBeNull();
  });
  it('cancels to the left and locks upward', () => {
    expect(voiceGesture(-80, 0)).toBe('cancel');
    expect(voiceGesture(0, -64)).toBe('lock');
  });
  it('uses the dominant direction on diagonal drags', () => {
    expect(voiceGesture(-120, -65)).toBe('cancel');
    expect(voiceGesture(-80, -120)).toBe('lock');
  });
});

describe('finishing dictation', () => {
  it('appends the whole transcript to the latest manual answer', () => {
    expect(appendDictation('Ручной текст', ' новая фраза ', 100)).toBe(
      'Ручной текст новая фраза',
    );
    expect(appendDictation('Ответ\n', 'Уточнение', 100)).toBe(
      'Ответ\nУточнение',
    );
  });
  it('rejects overflow without truncation or altering existing text', () => {
    expect(appendDictation('12345', '6789', 9)).toBeNull();
    expect(appendDictation('12345', '6789', 10)).toBe('12345 6789');
  });
  it('ignores an empty transcript', () => {
    expect(appendDictation('Исходный ответ', '  ', 100)).toBe('Исходный ответ');
  });
});
