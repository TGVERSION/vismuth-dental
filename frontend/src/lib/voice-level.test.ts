import { describe, expect, it } from 'vitest';
import { voiceLevel } from './voice-level';

describe('local microphone level', () => {
  it('has no volume for silence or an empty sample', () => {
    expect(voiceLevel(new Float32Array())).toBe(0);
    expect(voiceLevel(new Float32Array(256))).toBe(0);
  });
  it('uses signal energy regardless of its sign', () => {
    expect(voiceLevel(new Float32Array([0.05, -0.05]))).toBeCloseTo(0.3);
  });
  it('clamps loud audio to one', () => {
    expect(voiceLevel(new Float32Array([1, -1]))).toBe(1);
  });
});
