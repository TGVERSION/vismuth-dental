'use client';

import { SafeImage } from '@/components/SafeImage';

interface ClinicLogoProps {
  url: string | null | undefined;
  clinicName: string;
}

/**
 * Логотип клиники. URL приходит с сервера и проверяется в `SafeImage`:
 * опасные схемы и чужие хосты без https отклоняются, и вместо картинки
 * показывается название клиники.
 */
export const ClinicLogo = ({ url, clinicName }: ClinicLogoProps) => (
  <SafeImage
    src={url}
    alt={clinicName}
    width={160}
    height={40}
    className="h-13 w-auto object-contain"
    priority
    fallback={
      <span className="text-lg font-semibold text-[var(--q-logo-contrast)]">
        {clinicName}
      </span>
    }
  />
);
