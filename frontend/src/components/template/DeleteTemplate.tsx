'use client';

import { toast } from 'react-toastify';
import Image from 'next/image';

interface DeleteTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export const DeleteTemplate: React.FC<DeleteTemplateProps> = ({
  isOpen,
  onClose,
  onDelete,
}) => {
  //useLockBodyScroll(isOpen);

  const handleDelete = async () => {
    try {
      await onDelete();
      toast.success('Шаблон удалён', {
        position: 'top-right',
        autoClose: 3000,
      });
      onClose();
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error);
      toast.error('Не удалось удалить шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
  };

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
        {/* Кнопка закрытия */}
        <div className="flex justify-end">
          <button onClick={onClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        {/* Заголовок */}
        <h2 className="text-[34px] font-medium text-center mb-7.5 px-5">
          Вы действительно хотите удалить шаблон?
        </h2>

        {/* Кнопки действий */}
        <div className="flex flex-col gap-3 px-5 pb-5">
          <button
            onClick={handleDelete}
            className="cursor-pointer h-12 w-full py-3 bg-[#F15D5D] hover:bg-[#F26E6E] text-white rounded-xl transition-colors"
          >
            Удалить
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer h-12 w-full py-3 bg-[#DCE7FF] hover:bg-[#F0F5FF] rounded-xl transition-colors"
          >
            Оставить
          </button>
        </div>
      </div>
    </div>
  );
};
