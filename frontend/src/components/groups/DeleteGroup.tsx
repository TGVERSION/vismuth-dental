'use client';

import { toast } from 'react-toastify';
import Image from 'next/image';
import { logError } from '@/lib/logger';
interface DeleteGroupProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export const DeleteGroup: React.FC<DeleteGroupProps> = ({
  isOpen,
  onClose,
  onDelete,
}) => {
  //useLockBodyScroll(isOpen);

  const handleDelete = async () => {
    try {
      await onDelete();
      toast.success(`Группа удалена`, {
        position: 'top-right',
        autoClose: 4000,
      });
      onClose();
    } catch (error) {
      logError('Ошибка удаления группы:', error);
      toast.error('Не удалось удалить группу', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay px-4 fixed inset-0 bg-black/50 flex items-center justify-center z-[calc(var(--ui-z-modal)+2)]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl p-5 shadow-[var(--ui-shadow)] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="vismuth-icon-button cursor-pointer"
          >
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>
        <h2 className="text-[length:var(--ui-font-size-34)] font-medium text-center mb-5 px-5">
          Вы действительно хотите удалить группу шаблонов?
        </h2>
        <div className="mb-[var(--ui-space-32)] px-5 text-[length:var(--ui-font-size-18)] text-center text-[var(--ui-color-alabaster-950)]">
          Все шаблоны из этой группы перейдут в раздел “Шаблоны без группы”
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={handleDelete}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-red-400)] hover:bg-[var(--ui-color-red-400)] text-white transition-colors"
            data-variant="danger"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-50)] transition-colors"
            data-variant="secondary"
          >
            Оставить
          </button>
        </div>
      </div>
    </div>
  );
};
