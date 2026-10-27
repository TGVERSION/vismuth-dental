'use client';

import type { PublicInvite } from '@/api';
import type { InviteLoadResult } from '@/api/server-api';
import { brandStyle } from '@/lib/branding';
import {
  appointmentLine,
  dentalProgress,
  dentalScreenFor,
  inviteGreeting,
} from '@/lib/dental-questionnaire';
import type { ClinicBranding, QuestionnaireBlock } from '@/lib/questionnaire';
import { useDentalQuestionnaire } from '@/hooks/useDentalQuestionnaire';
import { QuestionnaireStub } from '@/components/questionnaire/QuestionnaireStub';
import { QuestionnaireThemeProvider } from '@/components/questionnaire/QuestionnaireTheme';
import { ChecklistStep } from './ChecklistStep';
import { ChipGroupsStep } from './ChipGroupsStep';
import { DentalDoneScreen } from './DentalDoneScreen';
import { DentalShell } from './DentalShell';

const inviteBranding = (invite: PublicInvite): ClinicBranding => ({
  name: invite.clinic_name,
  phone: invite.phone,
  logo_url: invite.logo_url,
  brand_color: invite.brand_color,
});

const doctorLine = (invite: PublicInvite): string | null => {
  const doctor = invite.doctor;
  if (!doctor) return null;
  const name = [doctor.last_name, doctor.first_name, doctor.middle_name]
    .filter(Boolean)
    .join(' ');
  const specialization = doctor.specializations[0]?.name;
  return [name, specialization].filter(Boolean).join(', ') || null;
};

/** Приветствие над первым вопросом: имя уже в ссылке, спрашивать не нужно. */
const Intro = ({ invite }: { invite: PublicInvite }) => {
  const appointment = appointmentLine(invite.appointment_date, invite.appointment_time);
  const doctor = doctorLine(invite);
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[var(--q-surface)] px-4 py-3">
      <p className="text-[17px] font-semibold">
        {inviteGreeting(invite.patient_first_name, invite.patient_middle_name)}
      </p>
      {appointment ? <p className="text-[15px]">{appointment}</p> : null}
      {doctor ? <p className="text-sm text-[var(--q-muted)]">{doctor}</p> : null}
    </div>
  );
};

const InviteFlow = ({ invite, token }: { invite: PublicInvite; token: string }) => {
  const clinic = inviteBranding(invite);
  const flow = useDentalQuestionnaire(invite, token);
  const { step } = flow;

  if (flow.block) return <QuestionnaireStub state={flow.block} clinic={clinic} />;
  if (!step) return <QuestionnaireStub state="subscription_expired" clinic={clinic} />;

  const renderShell = (body: React.ReactNode, footer: React.ReactNode) => (
    <DentalShell clinic={clinic} progress={dentalProgress(step.step_key)} footer={footer}>
      {body}
    </DentalShell>
  );

  switch (dentalScreenFor(step)) {
    case 'done':
      return <DentalDoneScreen clinic={clinic} />;
    case 'chips':
      return (
        <ChipGroupsStep
          // Новый шаг — новый черновик ответа.
          key={step.step_key}
          step={step}
          isSubmitting={flow.isSubmitting}
          error={flow.error}
          onSubmit={(answer) => void flow.submit(answer)}
          intro={step.step_key === 'dental_reason' ? <Intro invite={invite} /> : undefined}
          renderShell={renderShell}
        />
      );
    case 'checklist':
      return (
        <ChecklistStep
          key={step.step_key}
          step={step}
          isSubmitting={flow.isSubmitting}
          error={flow.error}
          onSubmit={(answer) => void flow.submit(answer)}
          renderShell={renderShell}
        />
      );
    case 'unknown':
      return <QuestionnaireStub state="subscription_expired" clinic={clinic} />;
  }
};

const LOAD_BLOCK: Record<Exclude<InviteLoadResult['status'], 'ok'>, QuestionnaireBlock> = {
  not_found: 'invite_not_found',
  // Сбой загрузки — общий текст «Сервис временно недоступен».
  error: 'subscription_expired',
};

interface DentalQuestionnaireAppProps {
  token: string;
  result: InviteLoadResult;
}

/** Стоматологическая анкета по персональной ссылке регистратуры. */
export const DentalQuestionnaireApp = ({ token, result }: DentalQuestionnaireAppProps) => {
  const invite = result.status === 'ok' ? result.invite : null;
  const theme = brandStyle(invite ? inviteBranding(invite) : null);

  return (
    <QuestionnaireThemeProvider value={theme}>
      <div data-questionnaire className="q-page" style={theme}>
        <div className="q-shell">
          {invite ? (
            <InviteFlow invite={invite} token={token} />
          ) : (
            <QuestionnaireStub
              state={LOAD_BLOCK[result.status as 'not_found' | 'error']}
              clinic={null}
            />
          )}
        </div>
      </div>
    </QuestionnaireThemeProvider>
  );
};
