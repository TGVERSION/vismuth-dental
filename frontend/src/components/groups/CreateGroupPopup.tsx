'use client';

import { useState, useEffect } from 'react';
import { templateApi } from '@/api';
import type { Template } from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

interface CreateGroupPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
}

export const CreateGroupPopup: React.FC<CreateGroupPopupProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  useLockBodyScroll(isOpen);
  const [groupName, setGroupName] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set(),
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await templateApi.getList();
      const allTemplates = [
        ...(response.templates || []),
        ...(response.groups || []).flatMap((g) => g.templates || []),
      ];
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('Введите название группы', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      const newGroup = await templateApi.createGroup({
        name: groupName.trim(),
        type: 'personal',
      });

      if (selectedTemplates.size > 0) {
        for (const templateId of selectedTemplates) {
          await templateApi.updateTemplate(templateId, {
            groupId: newGroup.id,
          });
        }
      }

      toast.success('Новая группа создана', {
        position: 'top-right',
        autoClose: 3000,
      });

      onSuccess(newGroup.id);
      handleClose();
    } catch (error) {
      console.error('Ошибка создания группы:', error);
      toast.error('Не удалось создать группу', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedTemplates(new Set());
    onClose();
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-[1002]"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={handleClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={20} height={20} />
          </button>
        </div>

        <h2 className="text-[32px] font-medium mb-7.5 px-5">
          Создание группы шаблонов
        </h2>
        <div className="mb-6 px-5">
          <label className="block text-sm text-gray-600 mb-2">
            Название группы
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Введите название"
            className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]"
            autoFocus
          />
        </div>

        {templates.length > 0 && (
          <div className="mb-6 px-5">
            <label className="block text-sm text-gray-600 mb-3">
              Выберите шаблоны для этой группы
            </label>
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
              {templates.map((template) => (
                <label
                  key={template.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplates.has(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="w-5 h-5 rounded border-gray-300 text-[#5D8CF1] focus:ring-[#5D8CF1]"
                  />
                  <span
                    className={`text-sm px-2 py-0.75 rounded-full ${
                      template.type === 'personal'
                        ? 'bg-[#FFD6BF]'
                        : 'bg-[#CFE5E6]'
                    }`}
                  >
                    {template.type === 'personal' ? 'Личный' : 'Общий'}
                  </span>
                  <span className="text-sm text-[#202020] flex-1">
                    {template.name}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Выбрано: {selectedTemplates.size} шаблон(ов)
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 bg-[#5D8CF1] text-white rounded-lg hover:bg-[#769CEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 h-12 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};
