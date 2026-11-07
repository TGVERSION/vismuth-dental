import type { DoctorQuestionnaireDetail } from '@/api';
import {
  buildSections,
  formatAppointmentTime,
  isQuestionnaireReady,
  notReadyMessage,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { DentalDoctorSummary } from './DentalDoctorSummary';
import { ProtocolActionButton } from './ProtocolActionButton';
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

  return (
    <article className="flex flex-col gap-9">
      <header className="flex items-baseline gap-9 text-[var(--ui-color-alabaster-950)]">
        <span className="shrink-0 text-[length:var(--ui-font-size-20)]">
          {formatAppointmentTime(questionnaire.appointment_time)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[length:var(--ui-font-size-20)]">
          {questionnaire.code}
          {questionnaire.code && name && ' · '}
          {name}
        </span>
        {typeLabel && (
          <span className="shrink-0 text-[length:var(--ui-font-size-14)]">
            {typeLabel}
          </span>
        )}
      </header>

      {isReady ? (
        <>
          {questionnaire.kind === 'dental' && questionnaire.structured ? (
            <DentalDoctorSummary structured={questionnaire.structured} />
          ) : null}
          {questionnaire.kind === 'gastro' && questionnaire.structured ? (
            <GastroDoctorHighlights structured={questionnaire.structured} />
          ) : null}
          {buildSections(questionnaire).map((section) =>
            questionnaire.kind === 'gastro' && section.text.length > 3000 ? (
              <details
                key={section.key}
                className="rounded-xl border border-[var(--ui-color-slate-200)] p-4"
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
          {questionnaire.kind === 'gastro' && questionnaire.structured ? (
            <>
              <GastroDoctorHistory structured={questionnaire.structured} />
              <GastroPatientQuestions structured={questionnaire.structured} />
            </>
          ) : null}
          <ProtocolActionButton
            questionnaireId={questionnaire.id}
            protocolId={questionnaire.protocol_id}
          />
        </>
      ) : (
        <p className="py-10 text-center text-[var(--ui-color-alabaster-950)]">
          {notReadyMessage(questionnaire.processing_status)}
        </p>
      )}
    </article>
  );
};
