import type { DoctorQuestionnaireDetail } from '@/api';
import {
  buildSections,
  formatAppointmentTime,
  isQuestionnaireReady,
  notReadyMessage,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { ProtocolActionButton } from './ProtocolActionButton';
import { QuestionnaireSection } from './QuestionnaireSection';

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
      <header className="flex items-baseline gap-9 text-[#6C757D]">
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
          {buildSections(questionnaire).map((section) => (
            <QuestionnaireSection key={section.key} section={section} />
          ))}
          <ProtocolActionButton
            questionnaireId={questionnaire.id}
            protocolId={questionnaire.protocol_id}
          />
        </>
      ) : (
        <p className="py-10 text-center text-[#8B8B8B]">
          {notReadyMessage(questionnaire.processing_status)}
        </p>
      )}
    </article>
  );
};
