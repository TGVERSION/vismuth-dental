'use client';

interface ChatBubbleProps {
  author: 'assistant' | 'patient';
  children: React.ReactNode;
}

/**
 * Пузырь сообщения. Текст рендерится React'ом: и вопросы ассистента, и
 * ответы пациента приходят снаружи, и в разметку как разметка попадать
 * не должны.
 */
export const ChatBubble = ({ author, children }: ChatBubbleProps) => {
  const isPatient = author === 'patient';

  return (
    <div className={isPatient ? 'flex justify-end' : 'flex justify-start'}>
      {/* min-w-0 и break-words нужны вместе.
          Сплошная строка без пробелов не переносится сама, а у флекс-элемента
          `min-width: auto` равен ширине этой строки и перебивает `max-width`:
          пузырь раздувался шире экрана и появлялась горизонтальная прокрутка.
          `min-w-0` снимает этот минимум, `break-words` разрешает разрыв
          внутри слова, `whitespace-pre-line` сохраняет переносы строк,
          которые пациент поставил сам. */}
      <p
        className={`min-w-0 max-w-[80%] break-words whitespace-pre-line rounded-2xl px-4 py-3 ${
          isPatient
            ? 'rounded-br-md bg-[var(--q-bubble-out)] text-[var(--q-brand-contrast)]'
            : 'rounded-bl-md bg-[var(--q-bubble-in)]'
        }`}
      >
        {children}
      </p>
    </div>
  );
};

export const TypingIndicator = ({ hint }: { hint: string | null }) => (
  <div className="flex flex-col items-start gap-1">
    <span className="text-sm text-[var(--q-muted)]">Печатает…</span>
    {hint ? (
      <span className="text-xs text-[var(--q-muted)]">{hint}</span>
    ) : null}
  </div>
);
