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
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';
import { QuestionnaireSection } from '@/components/doctor-questionnaires/QuestionnaireSection';
import {
  GastroDoctorHighlights,
  GastroDoctorHistory,
  GastroPatientQuestions,
} from '@/components/doctor-questionnaires/GastroDoctorSummary';
export function CompletedDetail({
  data,
  onChanged,
}: {
  data: Detail;
  onChanged: () => void;
}) {
  const [printing, setPrinting] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
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
  const signed = async () => {
    setBusy(true);
    try {
      await mainApi.clinicQuestionnaires.markSigned(data.clinic_id, data.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить подпись');
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="space-y-9">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3 text-[#6C757D] lg:gap-9">
          <span className="shrink-0 text-[20px]">
            {formatAppointmentTime(data.appointment_time)}
          </span>
          <h2 className="min-w-0 flex-1 truncate text-[20px]">
            {data.code}
            {data.code && ' · '}
            {patientName(data) || 'Пациент'}
          </h2>
          <span className="shrink-0 text-[14px]">
            {visitTypeLabel(data.visit_type)}
          </span>
        </div>
        <p className="text-sm text-[#8B8B8B]">
          {data.clinic_name} ·{' '}
          {data.completed_at
            ? new Date(data.completed_at).toLocaleString('ru-RU')
            : ''}
        </p>
      </header>
      {sheet && (
        <div className="flex flex-wrap gap-4">
          <button
            className="vismuth-button vismuth-button--secondary"
            onClick={() => {
              flushSync(() => setPrinting(true));
              document.documentElement.setAttribute(
                'data-print-mode',
                'anketa',
              );
              window.print();
            }}
          >
            Печать
          </button>
          <button
            disabled={busy || !!data.signed_at}
            className="vismuth-button vismuth-button--secondary"
            onClick={() => void signed()}
          >
            {data.signed_at ? 'Подписана' : 'Отметить подписанной'}
          </button>
        </div>
      )}
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
          {data.kind === 'gastro' && data.structured && (
            <>
              <GastroDoctorHistory structured={data.structured} />
              <GastroPatientQuestions structured={data.structured} />
            </>
          )}
        </>
      )}
      <details>
        <summary className="cursor-pointer text-[var(--ui-color-blue-600)]">
          Сохранённые ответы
        </summary>
        <dl className="mt-4 space-y-4">
          {data.answers.map((a, i) => (
            <div key={i}>
              <dt className="font-medium">{a.question_text || a.step_key}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {a.answer_text || a.choice || 'Ответ не сообщён'}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      {printing && sheet && <AnketaPrintSheet sheet={sheet} />}
    </article>
  );
}
