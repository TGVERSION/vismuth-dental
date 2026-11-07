'use client';

import Image from 'next/image';

interface EditTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export const EditTemplatePopup: React.FC<EditTemplateProps> = ({
  isOpen,
  onClose,
  onEdit,
}) => {
  //useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay px-4 fixed inset-0 bg-black/50 flex items-center justify-center z-[calc(var(--ui-z-modal)+2)]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-[var(--ui-shadow)] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="vismuth-icon-button cursor-pointer"
          >
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        <h2 className="text-[length:var(--ui-font-size-34)] font-medium text-center mb-[var(--ui-space-32)] px-5">
          Хотите отредактировать шаблон протокола?
        </h2>

        <div className="flex flex-col gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onEdit}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-blue-600)] hover:bg-[var(--ui-color-blue-700)] text-white transition-colors"
            data-variant="primary"
          >
            Да, открыть редактор
          </button>
          <button
            type="button"
            onClick={onClose}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-50)] transition-colors"
            data-variant="secondary"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};
