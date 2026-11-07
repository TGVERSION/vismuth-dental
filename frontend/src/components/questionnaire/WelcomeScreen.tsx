'use client';

import type { ClinicBranding } from '@/lib/questionnaire';
import { ClinicLogo } from './ClinicLogo';
import { SpinnerButton } from '@/components/SpinnerButton';

interface WelcomeScreenProps {
  clinic: ClinicBranding;
  isStarting: boolean;
  error: string | null;
  onStart: () => void;
  gastroEntry?: boolean;
}

export const WelcomeScreen = ({
  clinic,
  isStarting,
  error,
  onStart,
  gastroEntry = false,
}: WelcomeScreenProps) => (
  <div
    className="q-screen flex min-h-[100dvh] flex-col bg-cover bg-center bg-no-repeat"
    style={{ backgroundImage: "url('/welcome-bg.webp')" }}
  >
    <header className="flex items-center justify-center bg-white px-4 py-2">
      <ClinicLogo url={clinic.logo_url} clinicName={clinic.name} />
    </header>
    <div className="bg-gradient-to-b from-[rgba(28,28,28,0)] via-[rgba(18,18,18,0.44)] to-[var(--ui-color-alabaster-dark-950)] flex flex-1 flex-col">
      <div className="mt-auto flex flex-col px-[15px] pt-[36px]">
        <h1 className="text-[length:var(--ui-font-size-34)] text-white font-bold">
          На связи Ассистент врача
        </h1>

        <p className="mt-[20px] text-white text-[length:var(--ui-font-size-18)] text-medium">
          {gastroEntry
            ? 'Расскажите, что вас беспокоит, и запишите вопросы врачу, чтобы не забыть важное на приёме. Ответы будут доступны врачу после отправки.'
            : 'Ответьте на несколько вопросов о том, что вас беспокоит, — врач заранее прочитает ответы и лучше подготовится к встрече с вами'}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 text-sm text-[var(--ui-color-red-700)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+56px)] pt-[42px]">
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          className="q-button w-full"
        >
          {isStarting ? <SpinnerButton /> : 'Ответить'}
        </button>
      </div>
    </div>
  </div>
);
