'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { logError } from '@/lib/logger';

interface RenameTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  onRename: (newName: string) => Promise<void>;
}

export const RenameTemplate: React.FC<RenameTemplateProps> = ({
  isOpen,
  onClose,
  templateName,
  onRename,
}) => {
  //useLockBodyScroll(isOpen);
  const [inputValue, setInputValue] = useState(templateName);

  const handleRename = async () => {
    const trimmedName = inputValue.trim();

    if (!trimmedName) {
      toast.warn('Название шаблона не может быть пустым', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    try {
      await onRename(trimmedName);
      toast.success('Шаблон успешно переименован', {
        position: 'top-right',
        autoClose: 3000,
      });
      onClose();
    } catch (error) {
      logError('Ошибка переименования шаблона:', error);
      toast.error('Не удалось переименовать шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
  };

  const handleClose = () => {
    setInputValue(templateName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay px-4 fixed inset-0 bg-black/50 flex items-center justify-center z-[calc(var(--ui-z-modal)+2)]"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-[var(--ui-shadow)] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="vismuth-icon-button cursor-pointer"
          >
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        <h2 className="text-[length:var(--ui-font-size-34)] font-medium text-left mb-8 px-5">
          Переименуйте шаблон
        </h2>
        <div className="px-5">
          <label className="block text-sm text-gray-600 mb-2">
            Название шаблона
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Введите название"
            className="vismuth-input w-full h-10 px-4 py-[var(--ui-space-10)] bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)]"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-3 px-5 pb-5 mt-[var(--ui-space-32)]">
          <button
            type="button"
            onClick={handleRename}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-blue-600)] hover:bg-[var(--ui-color-blue-700)] text-white transition-colors"
            data-variant="primary"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="vismuth-button cursor-pointer w-full bg-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-50)] transition-colors"
            data-variant="secondary"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};
