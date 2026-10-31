import type { DoctorQuestionnaireStructured } from '@/api';
import { readGastroHistory, readPatientQuestions } from '@/lib/gastro-history';

export function GastroDoctorHighlights({ structured }: { structured: DoctorQuestionnaireStructured }) {
  return <>
    {structured.important?.length ? <section className="space-y-3 rounded-xl border border-[#C46A36] bg-[#FFF6EC] p-5 text-[#713B1C]">
      <h2 className="text-lg font-semibold">Обратить внимание — со слов пациента</h2>
      <ul className="list-disc space-y-2 pl-5">{structured.important.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
    </section> : null}
    {structured.safety ? <details className="rounded-xl border border-[#D7DCE3] p-4">
      <summary className="cursor-pointer py-2 font-medium">Ответы о значимых признаках</summary>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{structured.safety}</p>
    </details> : null}
    {structured.clarifications?.length ? <section className="space-y-3">
      <h2 className="text-lg font-semibold">Уточнения</h2>
      {structured.clarifications.map((turn, i) => <div key={i}>
        <p className="font-medium">{turn.question}</p>
        <p className="mt-1 whitespace-pre-wrap break-words">{turn.answer || 'Ответ не сообщён'}</p>
      </div>)}
    </section> : null}
  </>;
}

export function GastroDoctorHistory({ structured }: { structured: DoctorQuestionnaireStructured }) {
  const history = readGastroHistory(structured.history);
  if (!history.raw.length && !history.chronology.length) return null;
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">История проблемы</h2>
    {history.chronology.length ? <dl className="space-y-3 border-l-2 border-[#D7DCE3] pl-4">
      {history.chronology.map((item, i) => <div key={i}>
        <dt className="font-medium">{item.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.value}</dd>
      </div>)}
    </dl> : <p className="text-sm text-[#6C757D]">Хронология отдельно не установлена. Исходный рассказ сохранён ниже.</p>}
    {history.raw.length ? <details className="rounded-xl border border-[#D7DCE3] p-4">
      <summary className="cursor-pointer py-2 font-medium">Полная история — как написал пациент</summary>
      <dl className="mt-4 space-y-5">{history.raw.map((item, i) => <div key={i}>
        <dt className="font-medium">{item.label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.value}</dd>
      </div>)}</dl>
    </details> : null}
  </section>;
}

export function GastroPatientQuestions({ structured }: { structured: DoctorQuestionnaireStructured }) {
  const questions = readPatientQuestions(structured.patient_questions);
  if (!questions.length) return null;
  return <section className="rounded-xl border border-[#D7DCE3] bg-[#FAFAFC] p-5">
    <h2 className="text-lg font-semibold">Вопросы пациента врачу</h2>
    <ol className="mt-4 list-decimal space-y-3 pl-5">{questions.map((question, i) => <li key={i} className="whitespace-pre-wrap break-words leading-relaxed">{question}</li>)}</ol>
  </section>;
}
