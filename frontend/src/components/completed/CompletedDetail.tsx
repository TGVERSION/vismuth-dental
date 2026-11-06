'use client';
import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { CompletedDetail as Detail } from '@/api/completed-api';
import { mainApi, type RegistryQuestionnaireDetail } from '@/api';
import { DentalCardBody } from '@/components/registry/DentalCardBody';
import { AnketaPrintSheet } from '@/components/registry/AnketaPrintSheet';
import { printSheet } from '@/lib/registry-print';
import { buildSections } from '@/lib/doctor-questionnaires';
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
    <article className="space-y-6">
      <header>
        <p className="text-sm text-gray-500">
          {data.clinic_name} ·{' '}
          {data.completed_at
            ? new Date(data.completed_at).toLocaleString('ru-RU')
            : ''}
        </p>
        <h2 className="mt-2 text-2xl">
          {[
            data.patient_last_name,
            data.patient_first_name,
            data.patient_middle_name,
          ]
            .filter(Boolean)
            .join(' ') || 'Пациент'}
        </h2>
      </header>
      {sheet && (
        <div className="flex gap-5">
          <button
            className="text-[#5D8CF1]"
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
            className="text-[#5D8CF1] disabled:opacity-50"
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
        <summary className="cursor-pointer text-[#5D8CF1]">
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
