'use client';

import { useState, useEffect, ChangeEvent, useRef, useCallback } from 'react';
import { mainApi } from '@/api';
import type {
  ListsGroupsResponse,
  TemplatesResponse,
  TemplatesRequest,
  FieldsType,
  FieldsTypeFull,
  ProtocolStructuresFields,
  StructureProtocolsFields,
} from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { CustomDropdown, type DropdownOption } from '../CustomDropdown';
import { useProtocolStructuresStore } from '@/store/protocolStructuresStore';

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
  const [loadingStructureFields, setLoadingStructureFields] = useState(false);

  const [templateContent, setTemplateContent] = useState<
    Record<string, string>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});

  const TEMPLATE_TYPE_OPTIONS: DropdownOption<'personal' | 'general'>[] = [
    {
      value: 'personal',
      label: 'Личный',
      badgeClass: 'bg-[#FFD6BF] text-[#202020]',
    },
    {
      value: 'general',
      label: 'Общий',
      badgeClass: 'bg-[#CFE5E6] text-[#202020]',
    },
  ];

  // Загрузка групп
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await mainApi.templateGroups.getGroups();
      setGroups((response || []).map((g) => ({ ...g, name: g.group_name })));
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
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
        console.error('Ошибка загрузки полей структуры:', error);
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
      content[field.field_name] = field.field_value;
    });
    return {
      ...template,
      name: template.protocol_name,
      type: template.privacy === 'personal' ? 'personal' : 'general',
      content,
      groupId: template.group_id,
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
      console.error('Ошибка создания шаблона:', error);
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
        className="modal-overlay fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-xl p-5 shadow-2xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end">
            <button onClick={handleClose} className="cursor-pointer">
              <Image alt="close" src="/close.svg" width={25} height={25} />
            </button>
          </div>

          <h2 className="text-[32px] font-medium mb-7.5 px-5">
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
                    renderTrigger={(option) => (
                      <span
                        className={`text-sm px-2 py-0.75 rounded-full ${option.badgeClass}`}
                      >
                        {option.label}
                      </span>
                    )}
                    renderOption={(option) => (
                      <span
                        className={`text-sm px-2 py-0.75 rounded-full ${option.badgeClass}`}
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
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]"
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
                    <span className="text-sm text-[#202020]">
                      Шаблоны без группы
                    </span>
                    {selectedGroupId === '' ? (
                      <span className="text-sm text-[#459F49] px-3 py-1.25 bg-[#D4FBD7] rounded-[10px] flex items-center gap-1">
                        <Image
                          alt="check"
                          src="/check.svg"
                          width={16}
                          height={16}
                        />
                        Выбрано
                      </span>
                    ) : (
                      <span className="text-sm text-[#5D8CF1] px-3 py-1.25 bg-[#DCE7FF] rounded-[10px] flex items-center gap-1">
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
                      <span className="text-sm text-[#202020]">
                        {group.name}
                      </span>
                      {selectedGroupId === group.id ? (
                        <span className="text-sm text-[#459F49] px-3 py-1.25 bg-[#D4FBD7] rounded-[10px] flex items-center gap-1">
                          <Image
                            alt="check"
                            src="/check.svg"
                            width={16}
                            height={16}
                          />
                          Выбрано
                        </span>
                      ) : (
                        <span className="text-sm text-[#5D8CF1] px-3 py-1.25 bg-[#DCE7FF] rounded-[10px] flex items-center gap-1">
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
                    onClick={() => setShowCreateGroupPopup(true)}
                    className="mt-3 mx-auto text-[16px] text-[#5D8CF1] cursor-pointer text-center hover:text-[#769CEF] transition-colors"
                  >
                    Создать новую группу
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 px-5 pb-5">
                <button
                  onClick={handleNext}
                  disabled={isFromPage ? saving : loading}
                  className="h-12 bg-[#5D8CF1] text-white cursor-pointer rounded-[15px] hover:bg-[#769CEF] transition-colors disabled:opacity-50"
                >
                  {isFromPage ? 'Сохранить' : 'Далее'}
                </button>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="h-12 rounded-[15px] hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF] transition-colors disabled:opacity-50"
                >
                  Отменить
                </button>
              </div>
            </div>
          ) : (
            // === ШАГ 2: Поля структуры ===
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
                  showCheckIcon={true}
                  renderOption={(option, isSelected) => (
                    <>
                      <span className="text-sm text-[#202020] flex-1">
                        {option.label}
                      </span>
                      {option.meta?.description && (
                        <span className="text-xs text-gray-500 ml-2 line-clamp-1">
                          {option.meta.description as string}
                        </span>
                      )}
                      {isSelected && (
                        <Image
                          src="/check.svg"
                          alt="selected"
                          width={16}
                          height={16}
                          className="ml-2 flex-shrink-0"
                        />
                      )}
                    </>
                  )}
                />

                {!structuresLoading && structureOptions.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Нет доступных структур протоколов
                  </p>
                )}
              </div>

              {/* === КОНТЕНТ ПОЛЕЙ === */}
              <div
                className={`${
                  currentProtocolStructure && 'space-y-6 mt-6 mb-6 pt-4'
                }`}
              >
                {currentProtocolStructure &&
                currentStructureFields.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      В выбранной структуре нет полей для заполнения
                    </p>
                  </div>
                ) : (
                  currentStructureFields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-2">
                      <label className="text-lg font-medium text-[#202020] flex items-center gap-2">
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
                        className="w-full px-4 py-3 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] resize-none text-sm leading-relaxed"
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Кнопки сохранения */}
              {currentProtocolStructure && (
                <div className="flex flex-col gap-3 sticky -bottom-10 bg-white pt-4">
                  <button
                    onClick={handleSave}
                    disabled={
                      saving ||
                      !currentProtocolStructure ||
                      currentStructureFields.length === 0
                    }
                    className="h-12 bg-[#5D8CF1] text-white rounded-[15px] hover:bg-[#769CEF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    disabled={saving}
                    className="h-12 rounded-[15px] hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
