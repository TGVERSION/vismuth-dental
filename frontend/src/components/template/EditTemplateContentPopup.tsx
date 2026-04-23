'use client';

import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { mainApi } from '@/api';
import type { TemplatesRequest, FieldsType } from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import type { TemplateUI } from './TemplatePopup';

interface EditTemplateContentPopupProps {
  isOpen: boolean;
  template: TemplateUI | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PROTOCOL_SECTIONS = [
  { key: 'complaints', label: 'Жалобы' },
  { key: 'disease_anamnesis', label: 'Анамнез заболевания' },
  { key: 'disease_history', label: 'История заболевания' },
  { key: 'life_anamnesis', label: 'Анамнез жизни' },
  { key: 'bad_habits', label: 'Вредные привычки и зависимости' },
  { key: 'allergy_anamnesis', label: 'Аллергологический анамнез' },
  { key: 'vital_parameters', label: 'Витальные параметры' },
  { key: 'objective_data', label: 'Объективные данные' },
  { key: 'clinical_assessment', label: 'Объективизированная оценка состояния' },
  { key: 'consultation_conclusion', label: 'Заключение консультации' },
  { key: 'main_diagnosis', label: 'Диагнозы' },
  { key: 'recommendations', label: 'Рекомендации' },
  { key: 'prescriptions', label: 'Назначения' },
];

export const EditTemplateContentPopup: React.FC<
  EditTemplateContentPopupProps
> = ({ isOpen, template, onClose, onSuccess }) => {
  useLockBodyScroll(isOpen);
  const [saving, setSaving] = useState(false);
  const [templateContent, setTemplateContent] = useState<
    Record<string, string>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});

  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(resizeTextarea);
  }, [templateContent]);

  useEffect(() => {
    if (isOpen && template) {
      setTemplateContent(template.content || {});
    } else if (!isOpen) {
      setTemplateContent({});
    }
  }, [isOpen, template]);

  const handleContentChange = (sectionKey: string, value: string) => {
    setTemplateContent((prev) => ({
      ...prev,
      [sectionKey]: value,
    }));
  };

  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      const fields: FieldsType[] = Object.entries(templateContent).map(
        ([fieldName, fieldValue]) => ({
          field_name: fieldName,
          field_type: 'text',
          field_value: fieldValue,
        }),
      );

      const updateData: TemplatesRequest = {
        protocol_name: template.name,
        group_id: template.groupId || '',
        privacy: template.type,
        fields,
      };

      await mainApi.templates.update(template.id, updateData);

      toast.success('Шаблон обновлён', {
        position: 'top-right',
        autoClose: 3000,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка обновления шаблона:', error);
      toast.error('Не удалось сохранить изменения', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !template) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 flex items-start justify-center z-[1003] pt-10 pb-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="cursor-pointer">
            <Image alt="close" src="/close.svg" width={25} height={25} />
          </button>
        </div>

        <h2 className="text-[32px] font-medium mb-7.5 px-5">
          Измените содержимое шаблона протокола
        </h2>

        <div className="mb-6 pb-4 px-5">
          <label className="block text-sm text-gray-600 mb-2">
            Структура протокола
          </label>
          <select className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]">
            <option>Приём врача терапевта</option>
            <option>Приём врача пульмонолога</option>
            <option>Приём врача кардиолога</option>
          </select>
        </div>

        <div className="space-y-6 mb-6 px-5">
          {PROTOCOL_SECTIONS.map((section) => (
            <div key={section.key} className="flex flex-col gap-2">
              <label className="text-lg font-medium text-[#202020]">
                {section.label}
              </label>
              <textarea
                ref={(el) => {
                  if (el) textareaRefs.current[section.key] = el;
                  else delete textareaRefs.current[section.key];
                }}
                value={templateContent[section.key] || ''}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  handleContentChange(section.key, e.target.value)
                }
                placeholder="Введите текст..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] resize-none text-sm leading-relaxed"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sticky -bottom-10 bg-white">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-12 bg-[#5D8CF1] text-white rounded-[15px] hover:bg-[#769CEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="h-12 rounded-[15px] hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};
