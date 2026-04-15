'use client';

import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { mainApi } from '@/api';
import type {
  ListsGroupsResponse,
  TemplatesResponse,
  TemplatesRequest,
  FieldsType,
  FieldsTypeFull,
} from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { CustomDropdown, type DropdownOption } from '../CustomDropdown';

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

export const CreateTemplatePopup: React.FC<CreateTemplatePopupProps> = ({
  isOpen,
  isFromPage,
  groupId,
  onClose,
  onSuccess,
  initialContent,
  stayInEditor = false,
}) => {
  useLockBodyScroll(isOpen);
  const [step, setStep] = useState<1 | 2>(1);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<'personal' | 'general'>(
    'personal',
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groups, setGroups] = useState<GroupUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);

  const [templateContent, setTemplateContent] = useState<
    Record<string, string>
  >(initialContent || {});
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
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    Object.values(textareaRefs.current).forEach(resizeTextarea);
  }, [templateContent]);
  const transformGroup = (group: ListsGroupsResponse): GroupUI => ({
    ...group,
    name: group.group_name,
  });

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

  const contentToFields = (content: Record<string, string>): FieldsType[] => {
    return Object.entries(content).map(([fieldName, fieldValue]) => ({
      field_name: fieldName,
      field_type: 'text',
      field_value: fieldValue,
    }));
  };

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setStep(1);
      setTemplateType('personal');
      setTemplateName('');
      setSelectedGroupId('');
      if (groupId) setSelectedGroupId(groupId);
      if (initialContent) {
        setTemplateContent(initialContent);
      } else {
        const emptyContent: Record<string, string> = {};
        PROTOCOL_SECTIONS.forEach((section) => {
          emptyContent[section.key] = '';
        });
        setTemplateContent(emptyContent);
      }
    }
  }, [isOpen, initialContent, groupId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const response = await mainApi.templateGroups.getGroups();
      setGroups((response || []).map(transformGroup));
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
      toast.error('Не удалось загрузить группы', {
        position: 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона', {
        position: 'top-right',
        autoClose: 3000,
      });
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
      toast.error('Введите название шаблона', {
        position: 'top-right',
        autoClose: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      const createRequest: TemplatesRequest = {
        protocol_name: templateName.trim(),
        group_id: selectedGroupId || '',
        privacy: templateType,
        fields: contentToFields(templateContent),
      };

      const newTemplateResponse = await mainApi.templates.create(createRequest);
      const newTemplate = transformTemplate(newTemplateResponse);

      toast.success(stayInEditor ? 'Шаблон сохранён' : 'Шаблон создан', {
        position: 'top-right',
        autoClose: 3000,
      });

      onSuccess(newTemplate);
      handleClose();
    } catch (error) {
      console.error('Ошибка создания шаблона:', error);
      toast.error('Не удалось создать шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setTemplateName('');
    setTemplateType('personal');
    setSelectedGroupId('');
    onClose();
  };

  const handleGroupCreated = (groupId: string) => {
    setSelectedGroupId(groupId);
    loadGroups();
    setShowCreateGroupPopup(false);
  };

  const handleContentChange = (sectionKey: string, value: string) => {
    setTemplateContent((prev) => ({
      ...prev,
      [sectionKey]: value,
    }));
  };

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

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
              <Image alt="close" src="/close.svg" width={20} height={20} />
            </button>
          </div>

          <h2 className="text-[32px] font-medium mb-7.5 px-5">
            Создание шаблона
          </h2>

          {step === 1 ? (
            <div>
              <div className="mb-6 px-5 flex flex-row gap-4">
                <div className="w-[111px]">
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
                      <>
                        <span
                          className={`text-sm px-2 py-0.75 rounded-full ${option.badgeClass}`}
                        >
                          {option.label}
                        </span>
                      </>
                    )}
                  />
                </div>
                <div className="w-[358px]">
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
                  <label
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border-0 hover:bg-gray-50 transition-colors`}
                  >
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
                      className={
                        'flex items-center justify-between p-3 rounded-lg cursor-pointer border-0 hover:bg-gray-50 transition-color'
                      }
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
                <div className="flex ">
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
            <div>
              <div className="mb-6 pb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  Структура протокола
                </label>
                <select className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1]">
                  <option>Приём врача пульмонолога</option>
                  <option>Приём врача терапевта</option>
                  <option>Приём врача кардиолога</option>
                </select>
              </div>

              <div className="space-y-6 mb-6">
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
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="h-12 rounded-[15px] hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
              </div>
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
