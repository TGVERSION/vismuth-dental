'use client';

import { useState, useEffect } from 'react';
import { templateApi } from '@/api';
import type { TemplateGroup, Template } from '@/api';
import Image from 'next/image';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { CreateTemplatePopup } from './CreateTemplatePopup';
import { toast } from 'react-toastify';
import { DeleteGroup } from '../groups/DeleteGroup';
import { DeleteTemplate } from './DeleteTemplate';

interface TemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: Template) => void;
}

export const TemplatePopup: React.FC<TemplatePopupProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  useLockBodyScroll(isOpen);

  const PROTOCOL_SECTIONS = [
    { key: 'complaints', label: 'Жалобы' },
    { key: 'disease_anamnesis', label: 'Анамнез заболевания' },
    { key: 'disease_history', label: 'История заболевания' },
    { key: 'life_anamnesis', label: 'Анамнез жизни' },
    { key: 'bad_habits', label: 'Вредные привычки и зависимости' },
    { key: 'allergy_anamnesis', label: 'Аллергологический анамнез' },
    { key: 'vital_parameters', label: 'Витальные параметры' },
    { key: 'objective_data', label: 'Объективные данные' },
    {
      key: 'clinical_assessment',
      label: 'Объективизированная оценка состояния',
    },
    { key: 'consultation_conclusion', label: 'Заключение консультации' },
    { key: 'main_diagnosis', label: 'Диагнозы' },
    { key: 'recommendations', label: 'Рекомендации' },
    { key: 'prescriptions', label: 'Назначения' },
  ];
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);
  const [showCreateTemplatePopup, setShowCreateTemplatePopup] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<{
    id: string;
    name: string;
    templatesCount: number;
  } | null>(null);

  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const requestDeleteGroup = (
    id: string,
    name: string,
    templatesCount: number,
  ) => {
    setDeleteGroupConfirm({ id, name, templatesCount });
  };
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('.template-create-menu button')) {
        return;
      }

      if (openMenuId && !target.closest('.template-actions-menu')) {
        setOpenMenuId(null);
      }

      if (
        showCreateMenu &&
        !target.closest('.template-create-menu') &&
        !target.closest('[data-create-menu-trigger]')
      ) {
        setShowCreateMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId, showCreateMenu]);
  useEffect(() => {
    if (isOpen) loadTemplates();
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await templateApi.getList();
      setGroups(response.groups || []);
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleApply = () => {
    if (selectedTemplate) {
      onApply(selectedTemplate);
      closeModal();
    }
  };

  const handleCreate = (type: 'template' | 'group', groupId?: string) => {
    setShowCreateMenu(false);
    if (type === 'group') {
      setShowCreateGroupPopup(true);
    } else {
      setShowCreateTemplatePopup(true);
      if (groupId) setSelectedGroupId(groupId);
    }
  };

  const requestDeleteTemplate = (id: string, name: string) => {
    setDeleteTemplateConfirm({ id, name });
    setOpenMenuId(null);
  };
  const handleDeleteTemplate = async () => {
    if (!deleteTemplateConfirm) return;

    const { id } = deleteTemplateConfirm;

    try {
      await templateApi.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));

      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          templates: group.templates?.filter((t) => t.id !== id),
        })),
      );

      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error);
      toast.error('Не удалось удалить шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
    }
  };
  const handleDeleteGroup = async () => {
    if (!deleteGroupConfirm) return;

    const { id } = deleteGroupConfirm;

    try {
      const groupToDelete = groups.find((g) => g.id === id);
      if (groupToDelete?.templates) {
        for (const template of groupToDelete.templates) {
          await templateApi.updateTemplate(template.id, {
            groupId: null,
          });
        }
      }

      await templateApi.deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));

      if (selectedTemplate?.groupId === id) {
        setSelectedTemplate(null);
      }

      loadTemplates();
    } catch (error) {
      console.error('Ошибка удаления группы:', error);
      toast.error('Не удалось удалить группу', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setDeleteGroupConfirm(null);
    }
  };

  const handleRename = async (
    id: string,
    type: 'group' | 'template',
    oldName: string,
  ) => {
    const newName = prompt('Новое название:', oldName);
    if (!newName || newName === oldName) return;
    try {
      if (type === 'group') {
        await templateApi.updateGroup(id, { name: newName });
        setGroups((prev) =>
          prev.map((g) => (g.id === id ? { ...g, name: newName } : g)),
        );
      } else {
        await templateApi.updateTemplate(id, { name: newName });
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? { ...t, name: newName } : t)),
        );
        if (selectedTemplate?.id === id) {
          setSelectedTemplate({ ...selectedTemplate, name: newName });
        }
      }
    } catch (error) {
      console.error('Ошибка переименования:', error);
    }
  };

  const closeModal = () => {
    onClose();
    setSelectedTemplate(null);
  };
  const handleGroupCreated = () => {
    setShowCreateGroupPopup(false);
    loadTemplates();
  };

  const handleTemplateCreated = () => {
    setShowCreateTemplatePopup(false);
    loadTemplates();
  };
  if (!isOpen) return null;
  const hasItems = groups.length > 0 || templates.length > 0;

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1">
            <div className="border-r border-gray-200 p-8 flex gap-4 flex-col max-w-102.25">
              <h2 className="text-2xl font-semibold text-[#202020]">
                Шаблоны протокола
              </h2>
              {!loading && (
                <div className="relative w-102.2">
                  <button
                    data-create-menu-trigger
                    onClick={() => setShowCreateMenu(!showCreateMenu)}
                    className="px-4 py-2 text-sm h-12 cursor-pointer bg-[#5D8CF1] text-white rounded-lg hover:bg-[#769CEF] transition-colors w-full"
                  >
                    Создать шаблон или группу
                  </button>
                  {showCreateMenu && (
                    <div className="absolute p-1.5 right-0 top-full bg-white border-0 rounded-lg shadow-lg py-2 mt-1.25 z-10 template-create-menu w-full">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleCreate('template');
                        }}
                        className="w-full cursor-pointer px-2.5 py-1.5 rounded-md text-left text-md hover:bg-[#F0F5FF] transition-colors"
                      >
                        Создать шаблон
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleCreate('group');
                        }}
                        className="w-full px-2.5 cursor-pointer py-1.5 rounded-md text-left text-md hover:bg-[#F0F5FF] transition-colors"
                      >
                        Создать группу
                      </button>
                    </div>
                  )}
                </div>
              )}
              {loading ? (
                <div className="text-center text-gray-500 py-8">
                  Загрузка...
                </div>
              ) : !hasItems ? (
                <div className="text-center text-md">Шаблоны не найдены</div>
              ) : (
                <div className="space-y-4.5">
                  <p className="text-medium text-xl">Группы</p>
                  <div className="flex flex-col gap-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className={`rounded-lg ${
                          expandedGroups.has(group.id) && 'bg-white shadow-md'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between px-3.75 py-3 cursor-pointer transition-all`}
                          onMouseEnter={() =>
                            setHoveredItem(`group-${group.id}`)
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Image
                              alt="arrow"
                              src="/arrow-dropdown.svg"
                              width={19}
                              height={19}
                              className={`transition-transform ${expandedGroups.has(group.id) ? 'rotate-180' : ''}`}
                            />
                            <span className="text-[#202020]">{group.name}</span>
                          </div>
                          {expandedGroups.has(group.id) && (
                            <div className="flex items-center gap-3.75 relative group">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteGroup(
                                    group.id,
                                    group.name,
                                    group.templates?.length || 0,
                                  );
                                }}
                                className="cursor-pointer"
                                title="Удалить группу"
                              >
                                <Image
                                  alt="delete"
                                  src="/delete-gray.svg"
                                  width={20}
                                  height={20}
                                  className={`}`}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRename(group.id, 'group', group.name);
                                }}
                                className="cursor-pointer"
                                title="Переименовать"
                              >
                                <Image
                                  alt="rename"
                                  src="/rename-gray.svg"
                                  width={20}
                                  height={20}
                                  className={`}`}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreate('template', group.id);
                                }}
                                className="cursor-pointer"
                                title="Добавить шаблон"
                              >
                                <Image
                                  alt="add"
                                  src="/add-gray.svg"
                                  width={20}
                                  height={20}
                                  className={``}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                        {expandedGroups.has(group.id) && group.templates && (
                          <div className="mt-0.75 mb-3.75 flex flex-col gap-3.75 mx-3.75">
                            {group.templates.map((template) => (
                              <div
                                key={template.id}
                                className={`px-3.75 py-3 rounded-lg cursor-pointer transition-all ${
                                  selectedTemplate?.id === template.id &&
                                  'bg-white shadow-md'
                                }`}
                                onMouseEnter={() =>
                                  setHoveredItem(`template-${template.id}`)
                                }
                                onMouseLeave={() => setHoveredItem(null)}
                                onClick={() => setSelectedTemplate(template)}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm px-2 py-0.75 rounded-full ${
                                      template.type === 'personal'
                                        ? 'bg-[#FFD6BF]'
                                        : 'bg-[#CFE5E6]'
                                    }`}
                                  >
                                    {template.type === 'personal'
                                      ? 'Личный'
                                      : 'Общий'}
                                  </span>
                                  <span className="text-sm text-[#202020]">
                                    {template.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {templates.length > 0 && (
                    <>
                      {groups.length > 0 && (
                        <p className="text-medium text-xl">
                          Шаблоны без группы
                        </p>
                      )}
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className={`px-3.75 py-3 rounded-lg cursor-pointer transition-all ${
                            selectedTemplate?.id === template.id &&
                            'bg-white shadow-md'
                          }`}
                          onMouseEnter={() =>
                            setHoveredItem(`template-${template.id}`)
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm px-2 py-0.75 rounded-full ${
                                template.type === 'personal'
                                  ? 'bg-[#FFD6BF]'
                                  : 'bg-[#CFE5E6]'
                              }`}
                            >
                              {template.type === 'personal'
                                ? 'Личный'
                                : 'Общий'}
                            </span>
                            <span className="text-sm text-[#202020]">
                              {template.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="mt-2.5 mr-2.5 cursor-pointer transition-colors"
                >
                  <Image
                    alt="close"
                    src="/close.svg"
                    width={20}
                    height={20}
                    className={``}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CreateGroupPopup
        isOpen={showCreateGroupPopup}
        onClose={() => setShowCreateGroupPopup(false)}
        onSuccess={handleGroupCreated}
      />
      <CreateTemplatePopup
        isOpen={showCreateTemplatePopup}
        isFromPage={false}
        groupId={selectedGroupId}
        onClose={() => setShowCreateTemplatePopup(false)}
        onSuccess={handleTemplateCreated}
      />
      <DeleteGroup
        isOpen={!!deleteGroupConfirm}
        onClose={() => setDeleteGroupConfirm(null)}
        onDelete={handleDeleteGroup}
      />
      <DeleteTemplate
        isOpen={!!deleteTemplateConfirm}
        onClose={() => setDeleteTemplateConfirm(null)}
        onDelete={handleDeleteTemplate}
      />
    </>
  );
};
