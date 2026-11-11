'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DoctorQuestionnaireDetail } from '@/api';
import { copyText } from '@/lib/clipboard';
import { dentalSummaryText } from '@/lib/dental-health';
import { buildSections } from '@/lib/doctor-questionnaires';
import { readGastroHistory, readPatientQuestions } from '@/lib/gastro-history';

type PictureInPictureWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (size: { width: number; height: number }) => Promise<Window>;
  };
};

const fieldsOf = (questionnaire: DoctorQuestionnaireDetail) => {
  const structured = questionnaire.structured;
  const history = readGastroHistory(structured?.history);
  return [
    ...buildSections(questionnaire).map(({ title, text }) => ({
      title,
      text: questionnaire.kind === 'dental' ? dentalSummaryText(text) : text,
    })),
    {
      title: 'Здоровье',
      text: (structured?.health ?? [])
        .filter((row) => row.has === true)
        .map((row) => (row.detail ? `${row.label}: ${row.detail}` : row.label))
        .join('\n'),
    },
    { title: 'О пациенте', text: structured?.about?.trim() ?? '' },
    { title: 'Значимые признаки', text: structured?.safety?.trim() ?? '' },
    {
      title: 'История проблемы',
      text: (history.raw.length ? history.raw : history.chronology)
        .map(({ label, value }) => `${label}: ${value}`)
        .join('\n'),
    },
    {
      title: 'Уточнения',
      text: (structured?.clarifications ?? [])
        .flatMap(({ question, answer }) =>
          answer?.trim() ? [`${question}\n${answer}`] : [],
        )
        .join('\n\n'),
    },
    {
      title: 'Вопросы пациента врачу',
      text: readPatientQuestions(structured?.patient_questions).join('\n'),
    },
  ].filter(({ text }) => Boolean(text));
};

export function FloatingQuestionnaire({
  questionnaire,
}: {
  questionnaire: DoctorQuestionnaireDetail;
}) {
  const floatingWindow = useRef<Window | null>(null);
  const mounted = useRef(false);
  const [target, setTarget] = useState<Window | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState({ title: '', copied: true });
  const fields = fieldsOf(questionnaire);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = floatingWindow.current;
      floatingWindow.current = null;
      current?.close();
    };
  }, []);

  const open = async () => {
    if (floatingWindow.current && !floatingWindow.current.closed) {
      floatingWindow.current.focus();
      return;
    }
    const api = (window as PictureInPictureWindow).documentPictureInPicture;
    if (!api) {
      setError('Плавающее окно недоступно в этом браузере.');
      return;
    }
    setError('');
    setIsOpening(true);
    try {
      const pip = await api.requestWindow({ width: 420, height: 560 });
      if (!mounted.current) {
        pip.close();
        return;
      }
      floatingWindow.current = pip;
      pip.document.title = 'Анкета пациента';
      pip.document.documentElement.lang = 'ru';
      pip.document.body.style.overflow = 'auto';
      for (const style of document.querySelectorAll(
        'link[rel="stylesheet"], style',
      )) {
        pip.document.head.appendChild(pip.document.importNode(style, true));
      }
      pip.addEventListener(
        'pagehide',
        () => {
          if (floatingWindow.current !== pip) return;
          floatingWindow.current = null;
          setTarget(null);
        },
        { once: true },
      );
      setCopyStatus({ title: '', copied: true });
      setTarget(pip);
    } catch {
      floatingWindow.current?.close();
      floatingWindow.current = null;
      if (mounted.current) setError('Не удалось открыть плавающее окно.');
    } finally {
      if (mounted.current) setIsOpening(false);
    }
  };

  const copy = async (title: string, text: string) => {
    if (!target || target.closed) return;
    try {
      await copyText(text, target);
      setCopyStatus({ title, copied: true });
    } catch {
      setCopyStatus({ title, copied: false });
    }
  };

  if (!fields.length) return null;

  return (
    <div className="shrink-0">
      <button
        type="button"
        className="vismuth-button vismuth-button--secondary"
        data-size="s"
        onClick={() => void open()}
        disabled={isOpening}
      >
        Открыть поверх окон
      </button>
      {error && (
        <p role="status" className="mt-2 text-sm">
          {error}
        </p>
      )}
      {target &&
        createPortal(
          <main className="flex flex-col gap-4 p-4 text-[var(--ui-color-alabaster-dark-800)]">
            {fields.map(({ title, text }) => (
              <section
                key={title}
                className="rounded-xl bg-[var(--ui-color-slate-100)] p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <button
                    type="button"
                    aria-label={`Скопировать «${title}»`}
                    title={
                      copyStatus.title === title && copyStatus.copied
                        ? 'Скопировано'
                        : 'Копировать'
                    }
                    onClick={() => void copy(title, text)}
                    className="vismuth-icon-button shrink-0"
                  >
                    <Image src="/copy.svg" alt="" width={16} height={16} />
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {text}
                </p>
              </section>
            ))}
            <p
              role="status"
              className={copyStatus.copied ? 'sr-only' : 'text-sm'}
            >
              {copyStatus.title &&
                (copyStatus.copied
                  ? `Скопировано: ${copyStatus.title}`
                  : 'Не удалось скопировать. Выделите текст и скопируйте его вручную.')}
            </p>
          </main>,
          target.document.body,
        )}
    </div>
  );
}
