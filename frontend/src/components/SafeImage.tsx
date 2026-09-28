'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { isExternalImageUrl, sanitizeImageUrl } from '@/lib/branding';

interface SafeImageProps {
  /** Адрес с сервера — недоверенные данные, проверяется здесь. */
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /** Что показать без картинки: адрес не прошёл проверку или не загрузился. */
  fallback?: ReactNode;
}

/**
 * Картинка по адресу с сервера.
 *
 * Путь того же origin рисуется через `next/image`. Внешний `https`-адрес —
 * обычным `<img>` с `referrerPolicy="no-referrer"`: домены заранее не
 * известны, поэтому `images.remotePatterns` не задать, а адрес страницы
 * (в анкете он содержит код пациента) не должен уходить на чужой хост.
 */
export const SafeImage = ({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fallback = null,
}: SafeImageProps) => {
  const safeSrc = sanitizeImageUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!safeSrc || failedSrc === safeSrc) return <>{fallback}</>;

  if (isExternalImageUrl(safeSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- внешний домен: remotePatterns не задать, нужен no-referrer
      <img
        src={safeSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailedSrc(safeSrc)}
      />
    );
  }

  return (
    <Image
      src={safeSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      onError={() => setFailedSrc(safeSrc)}
    />
  );
};
