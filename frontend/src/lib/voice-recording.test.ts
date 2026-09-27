import { describe, it, expect } from 'vitest';
import {
  AUDIO_BITS_PER_SECOND,
  estimateBytes,
  fileExtensionForMime,
  formatDuration,
  pickRecorderMimeType,
  RECORDER_MIME_CANDIDATES,
} from './voice-recording';

describe('pickRecorderMimeType', () => {
  it('выбирает opus, когда браузер поддерживает всё', () => {
    expect(pickRecorderMimeType(() => true)).toBe('audio/webm;codecs=opus');
  });

  // Safari не умеет webm: запись там должна идти в mp4, а не отключаться.
  it('падает на mp4, когда webm не поддержан', () => {
    const isSupported = (mimeType: string) => mimeType === 'audio/mp4';

    expect(pickRecorderMimeType(isSupported)).toBe('audio/mp4');
  });

  it('соблюдает порядок предпочтения', () => {
    const isSupported = (mimeType: string) =>
      mimeType !== 'audio/webm;codecs=opus';

    expect(pickRecorderMimeType(isSupported)).toBe('audio/webm');
  });

  // Без поддерживаемого типа запись невозможна, и кнопку показывать нельзя:
  // null здесь — это сигнал UI, а не повод для исключения.
  it('возвращает null, когда не поддержан ни один тип', () => {
    expect(pickRecorderMimeType(() => false)).toBeNull();
  });

  it('не предлагает типов вне известного списка', () => {
    const picked = pickRecorderMimeType(() => true);

    expect(RECORDER_MIME_CANDIDATES).toContain(picked);
  });
});

describe('fileExtensionForMime', () => {
  it('узнаёт форматы, в которых пишут браузеры', () => {
    expect(fileExtensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(fileExtensionForMime('audio/webm')).toBe('webm');
    expect(fileExtensionForMime('audio/mp4')).toBe('m4a');
    expect(fileExtensionForMime('audio/ogg;codecs=opus')).toBe('ogg');
  });

  it('не зависит от регистра и пробелов', () => {
    expect(fileExtensionForMime(' AUDIO/WEBM ;codecs=opus')).toBe('webm');
  });

  // Имя файла — только для читаемости логов на сервере, поэтому неизвестный
  // тип не повод для ошибки.
  it('даёт нейтральное расширение для неизвестного типа', () => {
    expect(fileExtensionForMime('audio/неизвестно')).toBe('bin');
    expect(fileExtensionForMime('')).toBe('bin');
  });
});

describe('formatDuration', () => {
  it('показывает минуты и секунды', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59_000)).toBe('00:59');
    expect(formatDuration(60_000)).toBe('01:00');
    expect(formatDuration(9 * 60_000 + 5_000)).toBe('09:05');
  });

  it('добавляет часы для длинного приёма', () => {
    expect(formatDuration(60 * 60_000)).toBe('1:00:00');
    expect(formatDuration(95 * 60_000 + 7_000)).toBe('1:35:07');
  });

  // Таймер на экране врача не должен показывать мусор, если часы системы
  // прыгнули назад или значение ещё не посчитано.
  it('не показывает мусор на некорректном значении', () => {
    expect(formatDuration(-1)).toBe('00:00');
    expect(formatDuration(Number.NaN)).toBe('00:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('estimateBytes', () => {
  it('считает объём по длительности и битрейту', () => {
    expect(estimateBytes(1000, 32_000)).toBe(4000);
    expect(estimateBytes(60_000, 32_000)).toBe(240_000);
  });

  it('по умолчанию берёт битрейт записи приёма', () => {
    expect(estimateBytes(1000)).toBe(AUDIO_BITS_PER_SECOND / 8);
  });

  it('возвращает ноль для пустой и некорректной длительности', () => {
    expect(estimateBytes(0)).toBe(0);
    expect(estimateBytes(-5)).toBe(0);
    expect(estimateBytes(Number.NaN)).toBe(0);
  });
});
