/** RMS from local microphone samples, normalised for a quiet speaking voice. */
export function voiceLevel(samples: Float32Array): number {
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  return Math.min(1, Math.sqrt(energy / samples.length) * 6);
}

/** Meter only: no recording, storage, network upload or connection to speakers. */
export function createVoiceMeter(onLevel: (value: number) => void) {
  let context: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let frame = 0;
  let closed = false;
  let started = false;
  try {
    if (typeof AudioContext !== 'undefined') {
      context = new AudioContext();
      void context.resume().catch(() => {});
    }
  } catch {
    /* Recognition works even if Web Audio is unavailable. */
  }
  const stop = () => {
    closed = true;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed')
      void context.close().catch(() => {});
    onLevel(0);
  };
  const start = async () => {
    if (closed || started || !context || !navigator.mediaDevices?.getUserMedia)
      return;
    started = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let smooth = 0,
        last = 0;
      const tick = (now: number) => {
        if (closed) return;
        if (now - last >= 32) {
          analyser.getFloatTimeDomainData(samples);
          smooth += (voiceLevel(samples) - smooth) * 0.35;
          onLevel(smooth);
          last = now;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch {
      stop(); /* Meter failure never prevents speech recognition. */
    }
  };
  return { start, stop };
}
