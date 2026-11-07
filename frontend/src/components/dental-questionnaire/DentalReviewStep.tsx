'use client';

import type { QuestionnaireStep, QuestionnaireStepAnswer } from '@/api';
import { DentalButton, DentalError } from './DentalShell';

/** Одна сводка каждого факта; полный печатный набор доступен по раскрытию. */
export const DentalReviewStep = ({
  step,
  error,
  isSubmitting,
  onSubmit,
  renderShell,
}: {
  step: QuestionnaireStep;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (answer: QuestionnaireStepAnswer) => void;
  renderShell: (
    body: React.ReactNode,
    footer: React.ReactNode,
  ) => React.ReactNode;
}) => {
  const review = step.dental?.review;
  const paper = review?.paper_form;
  const health = review?.health ?? [];
  const positive = health.filter((row) => row.has !== false);
  const negative = health.filter((row) => row.has === false);
  const groups = step.dental?.answers.groups ?? {};
  const more = groups['about.more']?.text;
  return (
    <>
      {renderShell(
        <>
          <h2 className="text-[length:var(--ui-font-size-23)] leading-tight font-semibold">
            Проверьте ответы
          </h2>
          <section className="rounded-2xl bg-[var(--q-surface)] p-4">
            <h3 className="font-semibold">Повод визита</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-[length:var(--ui-font-size-15)]">
              {review?.complaints || 'Не указан'}
            </p>
          </section>
          <section className="rounded-2xl bg-[var(--q-surface)] p-4">
            <h3 className="font-semibold">Здоровье</h3>
            {positive.length ? (
              positive.map((row) => (
                <p
                  key={row.key}
                  className="mt-2 whitespace-pre-wrap break-words text-[length:var(--ui-font-size-15)]"
                >
                  <b>{row.label}</b>:{' '}
                  {row.has === null ? 'Не уверен' : row.detail || 'Да'}
                </p>
              ))
            ) : (
              <p className="mt-2 text-[length:var(--ui-font-size-15)]">
                Ничего из перечисленного не отмечено.
              </p>
            )}
            {negative.length > 0 ? (
              <details className="mt-3">
                <summary className="min-h-[44px] cursor-pointer text-[length:var(--ui-font-size-15)]">
                  По остальным {negative.length} пунктам — «Нет». Посмотреть
                </summary>
                <ul className="mt-2 list-disc pl-5 text-[length:var(--ui-font-size-15)]">
                  {negative.map((row) => (
                    <li key={row.key}>{row.label}: Нет</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
          {paper ? (
            <section className="rounded-2xl bg-[var(--q-surface)] p-4 text-[length:var(--ui-font-size-15)]">
              <h3 className="font-semibold">О вас</h3>
              <p className="mt-2">
                Дата рождения: {paper.birth_date || 'Не указана'}
              </p>
              <p>
                Последний визит: {paper.visit_year || 'Год не указан'};{' '}
                {paper.visit_clinic || 'Клиника не указана'}
              </p>
              {more ? (
                <p className="mt-2 whitespace-pre-wrap break-words">
                  Дополнительно: {more}
                </p>
              ) : null}
            </section>
          ) : null}
          {review?.clarifications?.map((item, index) => (
            <section
              key={index}
              className="text-[length:var(--ui-font-size-15)]"
            >
              <h3 className="font-semibold">{item.question}</h3>
              <p className="whitespace-pre-wrap break-words">
                {item.answer || 'Пропущено'}
              </p>
            </section>
          ))}
          {paper ? (
            <details className="rounded-2xl bg-[var(--q-surface)] p-4 text-[length:var(--ui-font-size-15)]">
              <summary className="min-h-[44px] cursor-pointer">
                Все ответы для распечатки
              </summary>
              <ol className="space-y-3">
                {paper.rows.map((row) => (
                  <li key={row.number}>
                    <b>
                      {row.number}. {row.text}
                    </b>
                    {row.answer !== null ? (
                      <span>: {row.answer ? 'Да' : 'Нет'}</span>
                    ) : null}
                    {row.note ? (
                      <p className="whitespace-pre-wrap break-words">
                        {row.note}
                      </p>
                    ) : null}
                    {row.underline
                      .filter((entry) => entry.selected)
                      .map((entry) => (
                        <p key={entry.text}>{entry.text}</p>
                      ))}
                    {row.subs.map((sub) => (
                      <p key={sub.text}>
                        {sub.text}:{' '}
                        {sub.answer === null
                          ? 'Не уверен'
                          : sub.answer
                            ? 'Да'
                            : 'Нет'}
                        {sub.note ? ` — ${sub.note}` : ''}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
              {paper.more ? (
                <p className="mt-3 whitespace-pre-wrap break-words">
                  Дополнительные сведения: {paper.more}
                </p>
              ) : null}
            </details>
          ) : null}
        </>,
        <>
          <DentalError message={error} />
          <DentalButton
            isBusy={isSubmitting}
            onClick={() =>
              onSubmit({ step_key: step.step_key, choice: 'confirm' })
            }
          >
            Всё верно, отправить
          </DentalButton>
        </>,
      )}
    </>
  );
};
