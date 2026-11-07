'use client';

import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { mainApi } from '@/api';
import type {
  TemplatesRequest,
  FieldsType,
  ProtocolStructuresFields,
  StructureProtocolsFields,
} from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import type { TemplateUI } from './TemplatePopup';
import { useProtocolStructuresStore } from '@/store/protocolStructuresStore';
import { logError } from '@/lib/logger';

interface EditTemplateContentPopupProps {
  isOpen: boolean;
  template: TemplateUI | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditTemplateContentPopup: React.FC<
  EditTemplateContentPopupProps
> = ({ isOpen, template, onClose, onSuccess }) => {
  const { fetchStructureById } = useProtocolStructuresStore();

  const [saving, setSaving] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [currentStructure, setCurrentStructure] =
    useState<ProtocolStructuresFields | null>(null);
  const [currentStructureFields, setCurrentStructureFields] = useState<
    StructureProtocolsFields[]
  >([]);

  const [templateContent, setTemplateContent] = useState<
    Record<string, string>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});

  // Авто-ресайз textarea
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(resizeTextarea);
  }, [templateContent, currentStructureFields]);

  // Загрузка структуры и инициализация контента при открытии
  useEffect(() => {
    const loadTemplateData = async () => {
      if (!isOpen || !template) {
        setCurrentStructure(null);
        setCurrentStructureFields([]);
        setTemplateContent({});
        return;
      }

      setLoadingStructure(true);
      try {
        // 👇 Загружаем структуру по ID из шаблона
        if (template.protocol_structure_id) {
          const structure = await fetchStructureById(
            template.protocol_structure_id,
          );
          if (structure) {
            setCurrentStructure(structure);
            // Сортируем поля по порядку отображения
            const sortedFields = [...structure.fields].sort(
              (a, b) => a.sort_order - b.sort_order,
            );
            setCurrentStructureFields(sortedFields);

            // 👇 Инициализируем контент: приоритет у template.content, fallback на default_value
            const initialContent: Record<string, string> = {};
            sortedFields.forEach((field) => {
              initialContent[field.field_name] =
                template.content?.[field.field_name] ??
                field.default_value ??
                '';
            });
            setTemplateContent(initialContent);
          }
        } else {
          // Если у шаблона нет структуры — показываем пустое состояние
          setCurrentStructureFields([]);
          setTemplateContent(template.content || {});
        }
      } catch (error) {
        logError('Ошибка загрузки структуры шаблона:', error);
        toast.error('Не удалось загрузить структуру шаблона');
        setCurrentStructureFields([]);
      } finally {
        setLoadingStructure(false);
      }
    };

    loadTemplateData();
  }, [isOpen, template, fetchStructureById]);

  const handleContentChange = (fieldName: string, value: string) => {
    setTemplateContent((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    try {
      // 👇 Формируем fields только из полей текущей структуры
      const fields: FieldsType[] = currentStructureFields.map((field) => ({
        field_name: field.field_name,
        field_type: 'text', // или field.field_type если нужно
        field_value: templateContent[field.field_name] ?? '',
      }));

      const updateData: TemplatesRequest = {
        protocol_name: template.name,
        group_id: template.groupId || null,
        privacy: template.type,
        fields,
        protocol_structure_id: template.protocol_structure_id || '',
      };

      await mainApi.templates.update(template.id, updateData);

      toast.success('Шаблон обновлён', {
        position: 'top-right',
        autoClose: 3000,
      });

      onSuccess();
      onClose();
    } catch (error) {
      logError('Ошибка обновления шаблона:', error);
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
      className="modal-overlay px-4 fixed inset-0 flex items-start justify-center z-[calc(var(--ui-z-modal)+3)] pt-10 pb-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-5 shadow-[var(--ui-shadow)] animate-fade-in"
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

        <h2 className="text-[length:var(--ui-font-size-31)] font-medium mb-[var(--ui-space-32)] px-5">
          Измените содержимое шаблона протокола
        </h2>
        <div className="mb-6 pb-4 px-5">
          <label className="block text-sm text-gray-600 mb-2">
            Структура протокола
          </label>

          {loadingStructure ? (
            <div className="flex items-center gap-2 px-4 py-[var(--ui-space-10)] bg-gray-50 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--ui-color-blue-600)]"></div>
            </div>
          ) : currentStructure ? (
            <div className="px-4 py-[var(--ui-space-10)] bg-gray-50 rounded-lg flex items-center gap-2">
              <Image alt="lock" src="/lock.svg" width={20} height={20} />
              <div>
                <span className="text-sm font-regular text-[var(--ui-color-alabaster-950)]">
                  {currentStructure.structure_name}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-[var(--ui-space-10)] bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="text-sm text-yellow-800">
                Шаблон не привязан к структуре
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6 mb-6 px-5 max-h-96 overflow-y-auto custom-scrollbar">
          {loadingStructure ? (
            <div className="text-center py-12">
              <div className="animate-spin mx-auto mb-3 rounded-full h-6 w-6 border-b-2 border-[var(--ui-color-blue-600)]"></div>
              <p className="text-sm text-gray-600">Загрузка полей...</p>
            </div>
          ) : currentStructureFields.length === 0 ? (
            <div className="text-center py-12 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <Image
                src="/document-blank.svg"
                alt="no fields"
                width={48}
                height={48}
                className="mx-auto mb-3 opacity-50"
              />
              <p className="text-sm text-gray-600">
                {currentStructure
                  ? 'В структуре нет полей для редактирования'
                  : 'Выберите структуру для шаблона в настройках'}
              </p>
            </div>
          ) : (
            currentStructureFields.map((field) => (
              <div key={field.id} className="flex flex-col gap-2">
                <label className="text-lg font-medium text-[var(--ui-color-alabaster-dark-800)] flex items-center gap-2">
                  {field.field_label}
                  {field.is_required && (
                    <span className="text-red-500 text-sm">*</span>
                  )}
                </label>
                <textarea
                  ref={(el) => {
                    if (el) textareaRefs.current[field.field_name] = el;
                    else delete textareaRefs.current[field.field_name];
                  }}
                  value={templateContent[field.field_name] || ''}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    handleContentChange(field.field_name, e.target.value)
                  }
                  placeholder={field.description || 'Введите текст...'}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)] resize-none text-sm"
                />
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 sticky -bottom-10 bg-white pt-4 px-5 pb-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving || loadingStructure || currentStructureFields.length === 0
            }
            className="vismuth-button bg-[var(--ui-color-blue-600)] text-white cursor-pointer hover:bg-[var(--ui-color-blue-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-variant="primary"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="vismuth-button hover:bg-[var(--ui-color-blue-50)] cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-variant="secondary"
          >
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};
