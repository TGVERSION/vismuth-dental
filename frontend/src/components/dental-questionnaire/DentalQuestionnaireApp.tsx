'use client';

import type { PublicInvite } from '@/api';
import type { InviteLoadResult } from '@/api/server-api';
import { brandStyle } from '@/lib/branding';
import {
  AI_STEP,
  buildSkipAnswer,
  dentalProgress,
  dentalScreenFor,
  inviteGreeting,
} from '@/lib/dental-questionnaire';
import type { ClinicBranding, QuestionnaireBlock } from '@/lib/questionnaire';
import { useDentalQuestionnaire } from '@/hooks/useDentalQuestionnaire';
import { QuestionnaireStub } from '@/components/questionnaire/QuestionnaireStub';
import { QuestionnaireThemeProvider } from '@/components/questionnaire/QuestionnaireTheme';
import { ChatBubble } from '@/components/questionnaire/ChatBubble';
import { ChecklistStep } from './ChecklistStep';
import { ChipGroupsStep } from './ChipGroupsStep';
import { DentalDoneScreen } from './DentalDoneScreen';
import { DentalShell } from './DentalShell';
import { DentalReviewStep } from './DentalReviewStep';
import { DentalConversationStep } from './DentalConversationStep';

const inviteBranding = (invite: PublicInvite): ClinicBranding => ({
  name: invite.clinic_name,
  phone: invite.phone,
  logo_url: invite.logo_url,
  brand_color: invite.brand_color,
});

/**
 * Приветствие над первым вопросом: имя уже в ссылке, спрашивать не нужно.
 * Врача и приёма нет — анкета, как бумажная, к ним не привязана.
 */
const Intro = ({ invite }: { invite: PublicInvite }) => (
  <ChatBubble author="assistant">
    {`${inviteGreeting(invite.patient_first_name, invite.patient_middle_name)}\nЗадам несколько вопросов для безопасного лечения. Ответы конфиденциальны.`}
  </ChatBubble>
);

/** Над вопросом нейросети: пациент должен понимать, откуда вопрос. */
const AiBadge = () => (
  <p className="flex items-center gap-[var(--ui-space-6)] text-[length:var(--ui-font-size-13)] font-semibold text-[var(--ui-color-purple-700)]">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
    </svg>
    Уточним по вашим ответам
  </p>
);

const InviteFlow = ({
  invite,
  token,
}: {
  invite: PublicInvite;
  token: string;
}) => {
  const clinic = inviteBranding(invite);
  const flow = useDentalQuestionnaire(invite, token);
  const { step } = flow;

  if (flow.block)
    return <QuestionnaireStub state={flow.block} clinic={clinic} />;
  if (!step)
    return <QuestionnaireStub state="subscription_expired" clinic={clinic} />;

  const renderShell = (body: React.ReactNode, footer: React.ReactNode) => (
    <DentalShell
      clinic={clinic}
      progress={step.dental?.conversation_progress ?? dentalProgress(step)}
      activeKey={`${step.step_key}:${step.dental?.question_key ?? ''}`}
      history={step.dental?.history}
      intro={<Intro invite={invite} />}
      footer={footer}
    >
      {body}
    </DentalShell>
  );

  if (step.dental?.question_key && dentalScreenFor(step) !== 'done')
    return (
      <DentalConversationStep
        step={step}
        questionnaireId={invite.questionnaire_id}
        isSubmitting={flow.isSubmitting}
        error={flow.error}
        onSubmit={(answer) => void flow.submit(answer)}
        renderShell={renderShell}
      />
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
          questionnaireId={invite.questionnaire_id}
          isSubmitting={flow.isSubmitting}
          error={flow.error}
          onSubmit={(answer) => void flow.submit(answer)}
          intro={step.step_key === AI_STEP ? <AiBadge /> : undefined}
          onSkip={() => void flow.submit(buildSkipAnswer(step.step_key))}
          renderShell={renderShell}
        />
      );
    case 'checklist':
      return (
        <ChecklistStep
          key={step.step_key}
          step={step}
          questionnaireId={invite.questionnaire_id}
          isSubmitting={flow.isSubmitting}
          error={flow.error}
          onSubmit={(answer) => void flow.submit(answer)}
          renderShell={renderShell}
        />
      );
    case 'review':
      return (
        <DentalReviewStep
          key={step.step_key}
          step={step}
          error={flow.error}
          isSubmitting={flow.isSubmitting}
          onSubmit={(answer) => void flow.submit(answer)}
          renderShell={renderShell}
        />
      );
    case 'unknown':
      return <QuestionnaireStub state="subscription_expired" clinic={clinic} />;
  }
};

const LOAD_BLOCK: Record<
  Exclude<InviteLoadResult['status'], 'ok'>,
  QuestionnaireBlock
> = {
  not_found: 'invite_not_found',
  // Сбой загрузки — общий текст «Сервис временно недоступен».
  error: 'subscription_expired',
};

interface DentalQuestionnaireAppProps {
  token: string;
  result: InviteLoadResult;
}

/** Стоматологическая анкета по персональной ссылке регистратуры. */
export const DentalQuestionnaireApp = ({
  token,
  result,
}: DentalQuestionnaireAppProps) => {
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
