'use client';

import { useState, useEffect, ChangeEvent, useRef, useCallback } from 'react';
import { mainApi } from '@/api';
import type {
  ListsGroupsResponse,
  TemplatesResponse,
  TemplatesRequest,
  FieldsType,
  FieldsTypeFull,
  StructureProtocolsFields,
} from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { CustomDropdown, type DropdownOption } from '../CustomDropdown';
import { useProtocolStructuresStore } from '@/store/protocolStructuresStore';
import { logError } from '@/lib/logger';

export interface TemplateUI extends Omit<TemplatesResponse, 'fields'> {
  name: string;
  type: 'personal' | 'general';
  content?: Record<string, string>;
  groupId?: string;
}

export interface GroupUI extends ListsGroupsResponse {
  name: string;
}

interface CreateTemplatePopupProps {
  isOpen: boolean;
  isFromPage: boolean;
  groupId?: string | null;
  onClose: () => void;
  onSuccess: (template: TemplateUI) => void;
  initialContent?: Record<string, string>;
  stayInEditor?: boolean;
  currentStructure?: string | null;
}

export const CreateTemplatePopup: React.FC<CreateTemplatePopupProps> = ({
  isOpen,
  isFromPage,
  groupId,
  onClose,
  onSuccess,
  initialContent,
  stayInEditor = false,
  currentStructure,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<'personal' | 'general'>(
    'personal',
  );

  const {
    structures,
    isLoading: structuresLoading,
    fetchStructureById,
  } = useProtocolStructuresStore();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groups, setGroups] = useState<GroupUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);

  const [currentProtocolStructure, setCurrentProtocolStructure] = useState<
    string | null
  >(currentStructure || null);
  const [currentStructureFields, setCurrentStructureFields] = useState<
    StructureProtocolsFields[]
  >([]);
  const [_loadingStructureFields, setLoadingStructureFields] = useState(false);

  const [templateContent, setTemplateContent] = useState<
    Record<string, string>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});

  const TEMPLATE_TYPE_OPTIONS: DropdownOption<'personal' | 'general'>[] = [
    {
      value: 'personal',
      label: 'Личный',
      badgeClass:
        'bg-[var(--ui-color-red-200)] text-[var(--ui-color-alabaster-dark-800)]',
    },
    {
      value: 'general',
      label: 'Общий',
      badgeClass:
        'bg-[var(--ui-color-slate-300)] text-[var(--ui-color-alabaster-dark-800)]',
    },
  ];

  // Загрузка групп
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mainApi.templateGroups.getGroups();
      setGroups((response || []).map((g) => ({ ...g, name: g.group_name })));
    } catch (error) {
      logError('Ошибка загрузки групп:', error);
      toast.error('Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка полей структуры при выборе
  const loadStructureFields = useCallback(
    async (structureId: string) => {
      if (!structureId) {
        setCurrentStructureFields([]);
        return;
      }

      setLoadingStructureFields(true);
      try {
        const structure = await fetchStructureById(structureId);
        if (structure) {
          // Сортируем поля по порядку отображения
          const sortedFields = [...structure.fields].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          setCurrentStructureFields(sortedFields);

          // Инициализируем контент значениями по умолчанию из структуры
          const defaultContent: Record<string, string> = {};
          sortedFields.forEach((field) => {
            defaultContent[field.field_name] =
              initialContent?.[field.field_name] ?? field.default_value ?? '';
          });
          setTemplateContent(defaultContent);
        }
      } catch (error) {
        logError('Ошибка загрузки полей структуры:', error);
        toast.error('Не удалось загрузить поля структуры');
        setCurrentStructureFields([]);
      } finally {
        setLoadingStructureFields(false);
      }
    },
    [fetchStructureById, initialContent],
  );

  // Реакция на изменение выбранной структуры
  useEffect(() => {
    if (currentProtocolStructure) {
      loadStructureFields(currentProtocolStructure);
    } else {
      setCurrentStructureFields([]);
      setTemplateContent({});
    }
  }, [currentProtocolStructure, loadStructureFields]);

  // Инициализация при открытии модалки
  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setStep(1);
      setTemplateType('personal');
      setTemplateName('');
      setSelectedGroupId('');
      if (groupId) setSelectedGroupId(groupId);

      // Инициализация структуры
      if (currentStructure) {
        setCurrentProtocolStructure(currentStructure);
      } else {
        setCurrentProtocolStructure(null);
        setCurrentStructureFields([]);
        setTemplateContent({});
      }
    }
  }, [isOpen, initialContent, groupId, currentStructure, loadGroups]);

  // Авто-ресайз textarea
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(resizeTextarea);
  }, [templateContent, currentStructureFields]);

  // Трансформации
  const transformTemplate = (template: TemplatesResponse): TemplateUI => {
    const content: Record<string, string> = {};
    template.fields?.forEach((field: FieldsTypeFull) => {
      if (field.field_name) content[field.field_name] = field.field_value ?? '';
    });
    return {
      ...template,
      name: template.protocol_name || '',
      type: template.privacy === 'personal' ? 'personal' : 'general',
      content,
      groupId: template.group_id ?? undefined,
    };
  };

  const contentToFields = useCallback(
    (content: Record<string, string>): FieldsType[] => {
      return Object.entries(content).map(([fieldName, fieldValue]) => ({
        field_name: fieldName,
        field_type: 'text',
        field_value: fieldValue,
      }));
    },
    [],
  );

  // Обработчики
  const handleNext = () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }
    if (isFromPage) {
      handleSave();
    } else {
      setStep(2);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }
    if (!currentProtocolStructure) {
      toast.error('Выберите структуру протокола');
      return;
    }
    if (currentStructureFields.length === 0) {
      toast.error('Поля структуры не загружены');
      return;
    }

    setSaving(true);
    try {
      const createRequest: TemplatesRequest = {
        protocol_name: templateName.trim(),
        group_id: selectedGroupId || null,
        privacy: templateType,
        fields: contentToFields(templateContent),
        protocol_structure_id: currentProtocolStructure,
      };

      const newTemplateResponse = await mainApi.templates.create(createRequest);
      const newTemplate = transformTemplate(newTemplateResponse);

      toast.success(stayInEditor ? 'Шаблон сохранён' : 'Шаблон создан');

      onSuccess(newTemplate);
      handleClose();
    } catch (error) {
      logError('Ошибка создания шаблона:', error);
      toast.error('Не удалось создать шаблон');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setTemplateName('');
    setTemplateType('personal');
    setSelectedGroupId('');
    setCurrentProtocolStructure(null);
    setCurrentStructureFields([]);
    setTemplateContent({});
    onClose();
  };

  const handleGroupCreated = (groupId: string) => {
    setSelectedGroupId(groupId);
    loadGroups();
    setShowCreateGroupPopup(false);
  };

  const handleContentChange = (fieldName: string, value: string) => {
    setTemplateContent((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));
  const structureOptions: DropdownOption<string>[] = structures.map((s) => ({
    value: s.id,
    label: s.structure_name,
    meta: { description: s.description },
  }));

  if (!isOpen) return null;

  return (
    <>
      <div
        className="modal-overlay px-4 fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-xl p-5 shadow-[var(--ui-shadow)] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={step === 1 ? handleClose : () => setStep(1)}
              className="vismuth-icon-button cursor-pointer"
            >
              <Image alt="close" src="/close.svg" width={25} height={25} />
            </button>
          </div>

          <h2 className="text-[length:var(--ui-font-size-31)] font-medium mb-[var(--ui-space-32)] px-5">
            Создание шаблона
          </h2>

          {step === 1 ? (
            // === ШАГ 1: Основные настройки ===
            <div>
              <div className="mb-6 px-5 flex flex-row gap-4">
                <div className="w-27.75">
                  <label className="block text-sm text-gray-600 mb-2">
                    Тип шаблона
                  </label>
                  <CustomDropdown<'personal' | 'general'>
                    options={TEMPLATE_TYPE_OPTIONS}
                    value={templateType}
                    onChange={setTemplateType}
                    placeholder="Тип шаблона"
                    renderTrigger={(option) => {
                      const opt = Array.isArray(option) ? option[0] : option;
                      return (
                        <span
                          className={`text-sm px-2 py-[var(--ui-space-2)] rounded-full ${opt.badgeClass}`}
                        >
                          {opt.label}
                        </span>
                      );
                    }}
                    renderOption={(option) => (
                      <span
                        className={`text-sm px-2 py-[var(--ui-space-2)] rounded-full ${option.badgeClass}`}
                      >
                        {option.label}
                      </span>
                    )}
                  />
                </div>
                <div className="w-89.5">
                  <label className="block text-sm text-gray-600 mb-2">
                    Название шаблона
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Введите название"
                    className="vismuth-input w-full h-10 px-4 py-[var(--ui-space-10)] bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)]"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-6 px-5">
                <label className="block text-sm text-gray-600 mb-3">
                  Выберите группу для этого шаблона
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <label className="flex items-center justify-between p-3 rounded-lg cursor-pointer border-0 hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-[var(--ui-color-alabaster-dark-800)]">
                      Шаблоны без группы
                    </span>
                    {selectedGroupId === '' ? (
                      <span className="text-sm text-[var(--ui-color-green-600)] px-3 py-[var(--ui-space-4)] bg-[var(--ui-color-green-100)] rounded-[var(--ui-radius-lg)] flex items-center gap-1">
                        <Image
                          alt="check"
                          src="/check.svg"
                          width={16}
                          height={16}
                        />
                        Выбрано
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--ui-color-blue-600)] px-3 py-[var(--ui-space-4)] bg-[var(--ui-color-blue-100)] rounded-[var(--ui-radius-lg)] flex items-center gap-1">
                        Выбрать
                      </span>
                    )}
                    <input
                      type="radio"
                      name="group"
                      value=""
                      checked={selectedGroupId === ''}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="hidden"
                    />
                  </label>

                  {sortedGroups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer border-0 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-[var(--ui-color-alabaster-dark-800)]">
                        {group.name}
                      </span>
                      {selectedGroupId === group.id ? (
                        <span className="text-sm text-[var(--ui-color-green-600)] px-3 py-[var(--ui-space-4)] bg-[var(--ui-color-green-100)] rounded-[var(--ui-radius-lg)] flex items-center gap-1">
                          <Image
                            alt="check"
                            src="/check.svg"
                            width={16}
                            height={16}
                          />
                          Выбрано
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--ui-color-blue-600)] px-3 py-[var(--ui-space-4)] bg-[var(--ui-color-blue-100)] rounded-[var(--ui-radius-lg)] flex items-center gap-1">
                          Выбрать
                        </span>
                      )}
                      <input
                        type="radio"
                        name="group"
                        value={group.id}
                        checked={selectedGroupId === group.id}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupPopup(true)}
                    className="vismuth-function-button mt-3 mx-auto text-[length:var(--ui-font-size-16)] text-[var(--ui-color-blue-600)] cursor-pointer text-center hover:text-[var(--ui-color-blue-700)] transition-colors"
                  >
                    Создать новую группу
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 px-5 pb-5">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isFromPage ? saving : loading}
                  className="vismuth-button bg-[var(--ui-color-blue-600)] text-white cursor-pointer hover:bg-[var(--ui-color-blue-700)] transition-colors disabled:opacity-50"
                  data-variant="primary"
                >
                  {isFromPage ? 'Сохранить' : 'Далее'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="vismuth-button hover:bg-[var(--ui-color-blue-50)] cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors disabled:opacity-50"
                  data-variant="secondary"
                >
                  Отменить
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 pb-5">
              <div className="">
                <label className="block text-sm text-gray-600 mb-2">
                  Структура протокола
                </label>

                <CustomDropdown<string>
                  options={structureOptions}
                  value={currentProtocolStructure || ''}
                  onChange={(value) => {
                    setCurrentProtocolStructure(value || null);
                  }}
                  placeholder="Выберите структуру"
                  disabled={structuresLoading || structureOptions.length === 0}
                  renderOption={(option, _isSelected) => (
                    <>
                      <span className="text-sm text-[var(--ui-color-alabaster-dark-800)] flex-1">
                        {option.label}
                      </span>
                    </>
                  )}
                />

                {!structuresLoading && structureOptions.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Нет доступных структур протоколов
                  </p>
                )}
              </div>
              <div
                className={`${
                  currentProtocolStructure && 'space-y-6 mt-6 mb-6 pt-4'
                }`}
              >
                {currentProtocolStructure &&
                currentStructureFields.length === 0 ? (
                  <div className="text-center py-12 px-499">
                    <p className="text-sm text-yellow-800">
                      В выбранной структуре нет полей для заполнения
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
                        placeholder={'Введите текст...'}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)] resize-none text-sm"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Кнопки сохранения */}
              {currentProtocolStructure && (
                <div className="flex flex-col gap-3 sticky -bottom-10 bg-white pt-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      saving ||
                      !currentProtocolStructure ||
                      currentStructureFields.length === 0
                    }
                    className="vismuth-button bg-[var(--ui-color-blue-600)] text-white hover:bg-[var(--ui-color-blue-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-variant="primary"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={saving}
                    className="vismuth-button hover:bg-[var(--ui-color-blue-50)] cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-variant="secondary"
                  >
                    Назад
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateGroupPopup
        isOpen={showCreateGroupPopup}
        onClose={() => setShowCreateGroupPopup(false)}
        onSuccess={handleGroupCreated}
      />
    </>
  );
};
