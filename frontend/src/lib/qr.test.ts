import { describe, expect, it } from 'vitest';
import {
  QR_QUIET_ZONE,
  buildQrMatrix,
  normalizeQrUrl,
  qrPathData,
  qrViewBoxSize,
} from './qr';

const URL_SAMPLE = 'https://vismuth.example.ru/q/abcd1234';

describe('normalizeQrUrl', () => {
  it('обычный адрес — без изменений', () => {
    expect(normalizeQrUrl(URL_SAMPLE)).toBe(URL_SAMPLE);
    expect(normalizeQrUrl('http://localhost:3000/q/demo')).toBe(
      'http://localhost:3000/q/demo',
    );
  });

  it('кириллический домен — в punycode, строка ASCII', () => {
    const normalized = normalizeQrUrl('https://клиника.рф/q/abcd');

    expect(normalized).toBe('https://xn--80apagcdp.xn--p1ai/q/abcd');
    expect(/^[\x20-\x7e]*$/.test(normalized ?? '')).toBe(true);
  });

  it('не http(s) и не адрес — null', () => {
    expect(normalizeQrUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeQrUrl('ftp://example.ru/q/abcd')).toBeNull();
    expect(normalizeQrUrl('')).toBeNull();
    expect(normalizeQrUrl('не адрес')).toBeNull();
  });
});

describe('buildQrMatrix', () => {
  const matrix = buildQrMatrix(URL_SAMPLE);
  const size = matrix.length;

  it('квадратная, сторона 21 + 4k', () => {
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 21) % 4).toBe(0);
    expect(matrix.every((row) => row.length === size)).toBe(true);
  });

  it('одинаковый вход — одинаковая матрица', () => {
    expect(buildQrMatrix(URL_SAMPLE)).toEqual(matrix);
  });

  it('левый верхний поисковый узор: рамка, светлое кольцо, тёмный центр', () => {
    for (let i = 0; i < 7; i += 1) {
      // Рамка 7×7.
      expect(matrix[0][i]).toBe(true);
      expect(matrix[6][i]).toBe(true);
      expect(matrix[i][0]).toBe(true);
      expect(matrix[i][6]).toBe(true);
    }
    for (let i = 1; i < 6; i += 1) {
      // Светлое кольцо 5×5.
      expect(matrix[1][i]).toBe(false);
      expect(matrix[5][i]).toBe(false);
      expect(matrix[i][1]).toBe(false);
      expect(matrix[i][5]).toBe(false);
    }
    for (let row = 2; row < 5; row += 1) {
      for (let col = 2; col < 5; col += 1) {
        // Центр 3×3.
        expect(matrix[row][col]).toBe(true);
      }
    }
  });
});

describe('qrPathData', () => {
  const matrix = [
    [true, false],
    [false, true],
  ];

  it('по подпути на каждый тёмный модуль, со смещением на поля', () => {
    expect(qrPathData(matrix)).toBe(
      `M${QR_QUIET_ZONE} ${QR_QUIET_ZONE}h1v1h-1z` +
        `M${QR_QUIET_ZONE + 1} ${QR_QUIET_ZONE + 1}h1v1h-1z`,
    );
  });

  it('число подпутей равно числу тёмных модулей настоящего кода', () => {
    const real = buildQrMatrix(URL_SAMPLE);
    const dark = real.flat().filter(Boolean).length;

    expect(qrPathData(real).split('M').length - 1).toBe(dark);
  });

  it('без полей — модуль в начале координат', () => {
    expect(qrPathData(matrix, 0).startsWith('M0 0h1v1h-1z')).toBe(true);
  });
});

describe('qrViewBoxSize', () => {
  it('сторона матрицы плюс поля с двух сторон', () => {
    expect(qrViewBoxSize([[true]])).toBe(1 + QR_QUIET_ZONE * 2);
    expect(qrViewBoxSize([[true]], 0)).toBe(1);
  });
});
