'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import Image from 'next/image';

interface RenameGroupProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  onRename: (newName: string) => Promise<void>;
}

export const RenameGroup: React.FC<RenameGroupProps> = ({
  isOpen,
  onClose,
  groupName,
  onRename,
}) => {
  //useLockBodyScroll(isOpen);
  const [inputValue, setInputValue] = useState(groupName);

  const handleRename = async () => {
    const trimmedName = inputValue.trim();

    if (!trimmedName) {
      toast.warn('Название группы не может быть пустым', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    try {
      await onRename(trimmedName);
      toast.success('Группа успешно переименована', {
        position: 'top-right',
        autoClose: 3000,
      });
      onClose();
    } catch (error) {
      console.error('Ошибка переименования группы:', error);
      toast.error('Не удалось переименовать группы', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
  };

  const handleClose = () => {
    setInputValue(groupName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[1002]"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <div className="flex justify-end">
          <button onClick={handleClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        {/* Заголовок */}
        <h2 className="text-[34px] font-medium text-left mb-8 px-5">
          Переименуйте группу
        </h2>
        <div className="px-5">
          <label className="block text-sm text-gray-600 mb-2">
            Название группы
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Введите название"
            className="w-full h-10 px-4 py-2.5 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]"
            autoFocus
          />
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-col gap-3 px-5 pb-5 mt-7.5">
          <button
            onClick={handleRename}
            className="cursor-pointer h-12 w-full py-3 bg-[#5D8CF1] hover:bg-[#769CEF] text-white rounded-xl transition-colors"
          >
            Сохранить
          </button>
          <button
            onClick={handleClose}
            className="cursor-pointer h-12 w-full py-3 bg-[#DCE7FF] hover:bg-[#F0F5FF] rounded-xl transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};
