'use client';

import Image from 'next/image';
import { sanitizeImageUrl } from '@/lib/branding';

interface ClinicLogoProps {
  url: string | null | undefined;
  clinicName: string;
}

/**
 * Логотип клиники. URL приходит с сервера, поэтому проходит проверку:
 * абсолютные адреса и опасные схемы отклоняются, и вместо картинки
 * показывается название клиники.
 */
export const ClinicLogo = ({ url, clinicName }: ClinicLogoProps) => {
  const safeUrl = sanitizeImageUrl(url);

  if (!safeUrl) {
    return (
      <span className="text-lg font-semibold text-[var(--q-brand)]">
        {clinicName}
      </span>
    );
  }

  return (
    <Image
      src={safeUrl}
      alt={clinicName}
      width={160}
      height={40}
      className="h-10 w-auto object-contain"
      priority
    />
  );
};
