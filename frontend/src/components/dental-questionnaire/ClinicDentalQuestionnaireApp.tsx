'use client';

import type { PublicLink } from '@/api';
import { useQuestionnaireFlow } from '@/hooks/useQuestionnaireFlow';
import { brandStyle } from '@/lib/branding';
import { clinicBranding } from '@/lib/questionnaire';
import { QuestionnaireStub } from '@/components/questionnaire/QuestionnaireStub';
import { QuestionnaireThemeProvider } from '@/components/questionnaire/QuestionnaireTheme';
import { WelcomeScreen } from '@/components/questionnaire/WelcomeScreen';
import { DentalFlow } from './DentalQuestionnaireApp';

export function ClinicDentalQuestionnaireApp({
  slug,
  link,
}: {
  slug: string;
  link: PublicLink | null;
}) {
  const flow = useQuestionnaireFlow(slug, link);
  const clinic = clinicBranding(link);
  const theme = brandStyle(clinic);
  const session = flow.questionnaire;

  return (
    <QuestionnaireThemeProvider value={theme}>
      <div data-questionnaire className="q-page" style={theme}>
        <div className="q-shell">
          {session && flow.step && clinic ? (
            <DentalFlow
              key={session.id}
              invite={{
                questionnaire_id: session.id,
                step: flow.step,
                blocked: false,
                block_code: null,
              }}
              token={session.token}
              clinic={clinic}
              onComplete={flow.finish}
            />
          ) : flow.block && !flow.isResuming ? (
            <QuestionnaireStub state={flow.block} clinic={clinic} />
          ) : clinic ? (
            <WelcomeScreen
              clinic={clinic}
              isStarting={flow.isStarting || flow.isResuming}
              error={flow.startError}
              onStart={() => void flow.start()}
            />
          ) : (
            <QuestionnaireStub state="invite_not_found" clinic={null} />
          )}
        </div>
      </div>
    </QuestionnaireThemeProvider>
  );
}
