'use client';

import { toast } from 'react-toastify';
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
      className="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[1002]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        <h2 className="text-[34px] font-medium text-center mb-7.5 px-5">
          Хотите отредактировать шаблон протокола?
        </h2>

        <div className="flex flex-col gap-3 px-5 pb-5">
          <button
            onClick={onEdit}
            className="cursor-pointer h-12 w-full py-3 bg-[#5D8CF1] hover:bg-[#769CEF] text-white rounded-xl transition-colors"
          >
            Да, открыть редактор
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer h-12 w-full py-3 bg-[#DCE7FF] hover:bg-[#F0F5FF] rounded-xl transition-colors"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};
