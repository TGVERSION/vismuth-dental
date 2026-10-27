'use client';

import type { ClinicBranding } from '@/lib/questionnaire';
import { ClinicLogo } from '@/components/questionnaire/ClinicLogo';

interface DentalDoneScreenProps {
  clinic: ClinicBranding;
}

/**
 * Анкета отправлена. Регистратура распечатает её — пациент подпишет лист
 * перед приёмом, как сейчас подписывает бумажную анкету.
 */
export const DentalDoneScreen = ({ clinic }: DentalDoneScreenProps) => (
  <div className="q-screen flex flex-col items-center px-6 pt-6 text-center">
    <ClinicLogo url={clinic.logo_url} clinicName={clinic.name} />
    <div
      aria-hidden="true"
      className="mt-16 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F4EC]"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#187A4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
    <h1 className="mt-6 text-2xl font-semibold">Спасибо, анкета у врача</h1>
    <p className="mt-3 text-[var(--q-muted)]">
      Перед приёмом в регистратуре попросят подписать распечатку анкеты.
    </p>
    {clinic.phone ? (
      <p className="mt-6 text-sm text-[var(--q-muted)]">
        Если что-то изменится — позвоните в клинику: {clinic.phone}
      </p>
    ) : null}
  </div>
);
