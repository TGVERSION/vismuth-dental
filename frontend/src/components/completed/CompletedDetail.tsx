'use client';
import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { CompletedDetail as Detail } from '@/api/completed-api';
import { mainApi, type RegistryQuestionnaireDetail } from '@/api';
import { DentalCardBody } from '@/components/registry/DentalCardBody';
import { AnketaPrintSheet } from '@/components/registry/AnketaPrintSheet';
import { printSheet } from '@/lib/registry-print';
import {
  buildSections,
  formatAppointmentTime,
  gapQuestions,
  isQuestionnaireReady,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { QuestionnaireSection } from '@/components/doctor-questionnaires/QuestionnaireSection';
import { QuestionnaireQuestions } from '@/components/dental-card/DentalCardParts';
import { FloatingQuestionnaire } from '@/components/doctor-questionnaires/FloatingQuestionnaire';
import {
  GastroDoctorHighlights,
  GastroDoctorHistory,
  GastroPatientQuestions,
} from '@/components/doctor-questionnaires/GastroDoctorSummary';
export function CompletedDetail({
  data,
  onChanged,
  doctorView = false,
}: {
  data: Detail;
  onChanged: () => void;
  doctorView?: boolean;
}) {
  const [printing, setPrinting] = useState(false),
    [error, setError] = useState('');
  const dental: RegistryQuestionnaireDetail = {
    ...data,
    status: data.signed_at
      ? 'signed'
      : data.printed_at
        ? 'printed'
        : 'completed',
    created_at: data.completed_at ?? '',
    invite_expires_at: null,
    patient_last_name: data.patient_last_name ?? null,
  };
  const sheet = data.kind === 'dental' ? printSheet(dental) : null;
  useEffect(() => {
    const done = () => {
      if (document.documentElement.getAttribute('data-print-mode') !== 'anketa')
        return;
      document.documentElement.removeAttribute('data-print-mode');
      setPrinting(false);
      mainApi.clinicQuestionnaires
        .markPrinted(data.clinic_id, data.id)
        .then(onChanged)
        .catch(() => setError('Не удалось отметить печать'));
    };
    window.addEventListener('afterprint', done);
    return () => {
      window.removeEventListener('afterprint', done);
      document.documentElement.removeAttribute('data-print-mode');
    };
  }, [data.clinic_id, data.id, onChanged]);
  return (
    <article className="space-y-9">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-[#6C757D]">
          {doctorView && isQuestionnaireReady(data) && (
            <FloatingQuestionnaire questionnaire={data} />
          )}
          {sheet && (
            <button
              type="button"
              className="vismuth-button vismuth-button--secondary"
              data-size="s"
              onClick={() => {
                flushSync(() => setPrinting(true));
                document.documentElement.setAttribute(
                  'data-print-mode',
                  'anketa',
                );
                window.print();
              }}
            >
              Распечатать
            </button>
          )}
          {data.kind !== 'dental' && (
            <span className="shrink-0 text-[20px]">
              {formatAppointmentTime(data.appointment_time)}
            </span>
          )}
          <h2 className="min-w-0 flex-1 truncate text-[20px]">
            {data.code}
            {data.code && ' · '}
            {patientName(data) || 'Пациент'}
          </h2>
          {data.kind === 'dental' && data.appointment_time && (
            <span className="shrink-0 text-[20px]">
              {formatAppointmentTime(data.appointment_time)}
            </span>
          )}
          <span className="shrink-0 text-[14px]">
            {visitTypeLabel(data.visit_type)}
          </span>
        </div>
        {!doctorView && (
          <p className="text-sm text-[#8B8B8B]">
            {data.clinic_name} ·{' '}
            {data.completed_at
              ? new Date(data.completed_at).toLocaleString('ru-RU')
              : ''}
          </p>
        )}
      </header>
      {sheet?.continuation.length ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          Длинные ответы будут полностью напечатаны на листах продолжения.
          Подпишите все листы.
        </p>
      ) : null}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {data.kind === 'dental' && data.structured ? (
        <DentalCardBody structured={data.structured} gaps={data.gaps} />
      ) : (
        <>
          {data.kind === 'gastro' && data.structured && (
            <GastroDoctorHighlights structured={data.structured} />
          )}
          {buildSections(data).map((s) => (
            <QuestionnaireSection key={s.key} section={s} />
          ))}
          <QuestionnaireQuestions questions={gapQuestions(data.gaps)} />
          {data.kind === 'gastro' && data.structured && (
            <>
              <GastroDoctorHistory structured={data.structured} />
              <GastroPatientQuestions structured={data.structured} />
            </>
          )}
        </>
      )}
      {printing && sheet && <AnketaPrintSheet sheet={sheet} />}
    </article>
  );
}
