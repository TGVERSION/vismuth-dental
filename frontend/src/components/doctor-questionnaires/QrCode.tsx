'use client';

import { useMemo } from 'react';
import { qrPathData, qrViewBoxSize, type QrMatrix } from '@/lib/qr';

interface QrCodeProps {
  matrix: QrMatrix;
  /** Подпись для экранного диктора: какой ссылки этот код. */
  label: string;
  /** Размер задаётся снаружи. */
  className?: string;
}

/**
 * QR-код как SVG из React-элементов: белый фон с полями и один путь из
 * тёмных модулей. Масштабируется без потерь — на экране и на печати.
 */
export const QrCode = ({ matrix, label, className }: QrCodeProps) => {
  const { path, size } = useMemo(
    () => ({ path: qrPathData(matrix), size: qrViewBoxSize(matrix) }),
    [matrix],
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
};
