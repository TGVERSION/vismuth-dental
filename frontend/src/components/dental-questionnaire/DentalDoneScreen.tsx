'use client';

import type { ClinicBranding } from '@/lib/questionnaire';

interface DentalDoneScreenProps {
  clinic: ClinicBranding;
}

/**
 * Анкета отправлена — экран того же вида, что финал общей анкеты
 * (`CodeScreen`). Регистратура распечатает анкету, пациент подпишет лист
 * перед приёмом, как сейчас подписывает бумажную.
 */
export const DentalDoneScreen = ({ clinic }: DentalDoneScreenProps) => (
  <div className="q-screen flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
    <h1 className="text-[24px] font-bold">Готово!</h1>
    <p className="mt-3 text-[var(--q-muted)]">
      Анкета у врача. Перед приёмом в регистратуре попросят подписать
      распечатку анкеты.
    </p>
    {clinic.phone ? (
      <p className="mt-8 text-center text-sm text-[var(--q-muted)]">
        Если что-то изменится — позвоните в клинику: {clinic.phone}
      </p>
    ) : null}
  </div>
);
