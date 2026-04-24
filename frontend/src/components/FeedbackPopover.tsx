export const FeedbackPopover = ({
  color,
  analysis,
  suggestedText,
  onApply,
  onClose,
}: {
  color: 'green' | 'yellow' | 'red';
  analysis: string;
  suggestedText: string;
  onApply: () => void;
  onClose: () => void;
}) => {
  const colorMap = {
    green: { header: 'text-[#459F49]', border: 'border-[#459F49]' },
    yellow: { header: 'text-[#F29100]', border: 'border-[#F29100]' },
    red: { header: 'text-[#D91528]', border: 'border-[#D91528]' },
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
          <span key={index} className="text-[#5D8CF1]">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="absolute z-50 w-fit max-w-2xl animate-fadeIn">
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden`}>
        <div className="p-1.5">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-medium ${styles.header}`}>
              {statusTitle}
            </h3>
          </div>
          {color !== 'green' && (
            <>
              <p className="text-sm mt-1.5 mb-1.5">
                {highlightText(suggestedText)}
              </p>
              <div className="flex justify-start">
                <button
                  onClick={onApply}
                  className="px-3 py-1.25 bg-[#5D8CF1] hover:bg-[#769CEF] cursor-pointer text-white text-sm rounded-xl transition-all"
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
