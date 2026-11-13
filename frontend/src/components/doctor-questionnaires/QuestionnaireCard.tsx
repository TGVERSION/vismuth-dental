import type { DoctorQuestionnaireDetail } from '@/api';
import {
  buildSections,
  formatAppointmentTime,
  gapQuestions,
  isQuestionnaireReady,
  notReadyMessage,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { DentalDoctorSummary } from './DentalDoctorSummary';
import { QuestionnaireQuestions } from '@/components/dental-card/DentalCardParts';
import { dentalSummaryText } from '@/lib/dental-health';
import { ProtocolActionButton } from './ProtocolActionButton';
import { FloatingQuestionnaire } from './FloatingQuestionnaire';
import { QuestionnaireSection } from './QuestionnaireSection';
import {
  GastroDoctorHighlights,
  GastroDoctorHistory,
  GastroPatientQuestions,
} from './GastroDoctorSummary';

interface QuestionnaireCardProps {
  questionnaire: DoctorQuestionnaireDetail;
}

/**
 * Открытая анкета. Необработанная — только шапка и строка статуса: по
 * решению пользователя такой анкеты у врача быть не должно, и создавать из
 * неё протокол нельзя. Защита нужна, пока backend отдаёт такие анкеты в
 * списке (ВЗ-6).
 */
export const QuestionnaireCard = ({
  questionnaire,
}: QuestionnaireCardProps) => {
  const name = patientName(questionnaire);
  const typeLabel = visitTypeLabel(questionnaire.visit_type);
  const isReady = isQuestionnaireReady(questionnaire);
  const isDental = questionnaire.kind === 'dental';

  return (
    <article className="flex flex-col gap-9">
      <header className="flex flex-wrap items-center gap-3 text-[#6C757D]">
        {isReady && <FloatingQuestionnaire questionnaire={questionnaire} />}
        <span className="shrink-0 text-[20px]">
          {formatAppointmentTime(questionnaire.appointment_time)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[20px]">
          {questionnaire.code}
          {questionnaire.code && name && ' · '}
          {name}
        </span>
        {typeLabel && <span className="shrink-0 text-[14px]">{typeLabel}</span>}
      </header>

      {isReady ? (
        <>
          {questionnaire.kind === 'dental' && questionnaire.structured ? (
            <DentalDoctorSummary structured={questionnaire.structured} />
          ) : null}
          {questionnaire.kind === 'gastro' && questionnaire.structured ? (
            <GastroDoctorHighlights structured={questionnaire.structured} />
          ) : null}
          {buildSections(questionnaire)
            .filter((section) => !isDental || dentalSummaryText(section.text))
            .map((section) =>
              questionnaire.kind === 'gastro' && section.text.length > 3000 ? (
                <details
                  key={section.key}
                  className="rounded-xl border border-[#D7DCE3] p-4"
                >
                  <summary className="cursor-pointer py-2 font-medium">
                    {section.title} — полный текст
                  </summary>
                  <div className="mt-4">
                    <QuestionnaireSection section={section} />
                  </div>
                </details>
              ) : (
                <QuestionnaireSection key={section.key} section={section} />
              ),
            )}
          <QuestionnaireQuestions
            questions={gapQuestions(questionnaire.gaps)}
          />
          {questionnaire.kind === 'gastro' && questionnaire.structured ? (
            <>
              <GastroDoctorHistory structured={questionnaire.structured} />
              <GastroPatientQuestions structured={questionnaire.structured} />
            </>
          ) : null}
          {questionnaire.protocol_id && (
            <ProtocolActionButton
              questionnaireId={questionnaire.id}
              protocolId={questionnaire.protocol_id}
            />
          )}
        </>
      ) : (
        <p className="py-10 text-center text-[#8B8B8B]">
          {notReadyMessage(questionnaire.processing_status)}
        </p>
      )}
    </article>
  );
};
