export const FeedbackPopover = ({
  color,
  suggestedText,
  onApply,
  style,
}: {
  color: 'green' | 'yellow' | 'red';
  analysis: string;
  suggestedText: string;
  onApply: () => void;
  onClose: () => void;
  style?: React.CSSProperties;
}) => {
  const colorMap = {
    green: {
      header: 'text-[var(--ui-color-green-600)]',
      border: 'border-[var(--ui-color-green-600)]',
    },
    yellow: {
      header: 'text-[var(--ui-color-yellow-600)]',
      border: 'border-[var(--ui-color-yellow-600)]',
    },
    red: {
      header: 'text-[var(--ui-color-red-600)]',
      border: 'border-[var(--ui-color-red-600)]',
    },
  };

  const statusTitles = {
    yellow: 'Текст можно улучшить',
    red: 'Нужно больше деталей',
    green: 'Отличная детализация! Вы молодец!',
  };

  const styles = colorMap[color];
  const statusTitle = statusTitles[color];

  const highlightText = (text: string) => {
    const parts = text.split(/(\[.*?\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return (
          <span key={index} className="text-[var(--ui-color-blue-600)]">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="absolute z-50 mb-1 w-fit max-w-2xl animate-fade-in"
      style={style}
    >
      <div
        className={`bg-white rounded-2xl shadow-[var(--ui-shadow)] overflow-hidden`}
      >
        <div className="p-[var(--ui-space-6)]">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-medium ${styles.header}`}>
              {statusTitle}
            </h3>
          </div>
          {color !== 'green' && (
            <>
              <p className="text-sm mt-[var(--ui-space-6)] mb-[var(--ui-space-6)]">
                {highlightText(suggestedText)}
              </p>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={onApply}
                  className="vismuth-button bg-[var(--ui-color-blue-600)] hover:bg-[var(--ui-color-blue-700)] cursor-pointer text-white transition-all"
                  data-variant="primary"
                  data-size="s"
                >
                  Применить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
