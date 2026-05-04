'use client';

import { useState, useEffect, useRef } from 'react';
import { mainApi } from '@/api';
import type {
  ListsGroupsResponse,
  ListsTemplatesResponse,
  TemplatesResponse,
  FieldsTypeFull,
} from '@/api';
import Image from 'next/image';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { CreateTemplatePopup } from './CreateTemplatePopup';
import { toast } from 'react-toastify';
import { DeleteGroup } from '../groups/DeleteGroup';
import { DeleteTemplate } from './DeleteTemplate';
import { RenameTemplate } from './RenameTemplatePopup';
import { RenameGroup } from '../groups/RenameGroupPopup';
import { MoveTemplatePopup } from './MoveTemplatePopup';
import { EditTemplatePopup } from './EditTemplatePopup';
import { EditTemplateContentPopup } from './EditTemplateContentPopup';

export interface TemplateGroupUI extends ListsGroupsResponse {
  name: string;
  templates?: TemplateUI[];
}

export interface TemplateUI extends ListsTemplatesResponse {
  name: string;
  type: 'personal' | 'general';
  content?: Record<string, string>;
  groupId?: string;
}

interface TemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: TemplateUI) => void;
}

export const TemplatePopup: React.FC<TemplatePopupProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  //useLockBodyScroll(isOpen);

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

  const [groups, setGroups] = useState<TemplateGroupUI[]>([]);
  const [templates, setTemplates] = useState<TemplateUI[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateUI | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [openRename, setOpenRename] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openMove, setOpenMove] = useState(false);

  const [openGroupRename, setOpenGroupRename] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<TemplateGroupUI | null>(
    null,
  );
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

  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const [showEditContentPopup, setShowEditContentPopup] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateUI | null>(
    null,
  );

  const handleDoubleClick = () => {
    if (selectedTemplate) {
      setShowEditConfirm(true);
    }
  };

  const handleEditConfirm = () => {
    setShowEditConfirm(false);
    if (selectedTemplate) {
      setEditingTemplate(selectedTemplate);
      setShowEditContentPopup(true);
    }
  };
  const handleTemplateUpdated = async () => {
    await loadTemplates();
    if (editingTemplate) {
      try {
        const fullTemplate = await mainApi.templates.getTemplate(
          editingTemplate.id,
        );
        const transformed = transformTemplate(fullTemplate);
        setSelectedTemplate(transformed);
      } catch (error) {
        console.error('Ошибка загрузки шаблона:', error);
      }
    }
    setShowEditContentPopup(false);
    setEditingTemplate(null);
  };
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

      if (target.closest('.template-create-menu button')) return;

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

  const transformGroup = (group: ListsGroupsResponse): TemplateGroupUI => ({
    ...group,
    name: group.group_name,
    templates: [],
  });

  const transformTemplate = (
    template: ListsTemplatesResponse | TemplatesResponse,
  ): TemplateUI => {
    const content: Record<string, string> = {};
    if ('fields' in template && Array.isArray(template.fields)) {
      template.fields.forEach((field: FieldsTypeFull) => {
        content[field.field_name] = field.field_value;
      });
    }
    return {
      ...template,
      name: template.protocol_name,
      type: template.privacy === 'personal' ? 'personal' : 'general',
      content,
      groupId: template.group_id,
    };
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const [groupsResponse, templatesResponse] = await Promise.all([
        mainApi.templateGroups.getGroups(),
        mainApi.templates.getTemplates(),
      ]);

      const transformedGroups = (groupsResponse || []).map(transformGroup);
      const transformedTemplates = (templatesResponse || []).map(
        transformTemplate,
      );

      const groupsWithTemplates = transformedGroups.map((group) => ({
        ...group,
        templates: transformedTemplates.filter((t) => t.group_id === group.id),
      }));

      const ungroupedTemplates = transformedTemplates.filter(
        (t) => !t.group_id,
      );

      setGroups(groupsWithTemplates);
      setTemplates(ungroupedTemplates);
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
      toast.error('Не удалось загрузить шаблоны', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: TemplateUI) => {
    setTemplateLoading(true);
    try {
      const fullTemplate = await mainApi.templates.getTemplate(template.id);
      const transformed = transformTemplate(fullTemplate);
      setSelectedTemplate(transformed);
    } catch (error) {
      console.error('Ошибка загрузки шаблона:', error);
      toast.error('Не удалось загрузить шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
      setSelectedTemplate(template);
    } finally {
      setTemplateLoading(false);
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
      await mainApi.templates.delete(id);
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
          const fullTemplate = await mainApi.templates.getTemplate(template.id);
          await mainApi.templates.update(template.id, {
            protocol_name: template.protocol_name,
            group_id: null,
            privacy: template.privacy,
            fields: fullTemplate.fields || [],
          });
        }
      }
      await mainApi.templateGroups.delete(id);
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
    newName: string,
  ) => {
    if (!newName) return;

    try {
      if (type === 'group') {
        await mainApi.templateGroups.update(id, { group_name: newName });
        setGroups((prev) =>
          prev.map((g) =>
            g.id === id ? { ...g, name: newName, group_name: newName } : g,
          ),
        );
      } else {
        const template = templates.find((t) => t.id === id) || selectedTemplate;
        if (!template) return;

        const fullTemplate = await mainApi.templates.getTemplate(id);

        await mainApi.templates.update(id, {
          protocol_name: newName,
          group_id: fullTemplate.group_id || '',
          privacy: fullTemplate.privacy,
          fields: fullTemplate.fields || [],
        });

        setTemplates((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, name: newName, protocol_name: newName } : t,
          ),
        );

        setGroups((prev) =>
          prev.map((group) => ({
            ...group,
            templates: group.templates?.map((t) =>
              t.id === id ? { ...t, name: newName, protocol_name: newName } : t,
            ),
          })),
        );

        if (selectedTemplate?.id === id) {
          setSelectedTemplate({
            ...selectedTemplate,
            name: newName,
            protocol_name: newName,
          });
        }
      }
    } catch (error) {
      console.error('Ошибка переименования:', error);
      toast.error('Не удалось переименовать', {
        position: 'top-right',
        autoClose: 4000,
      });
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
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)] animate-fade-in"
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
                  {groups.length > 0 && (
                    <div>
                      {' '}
                      <p className="text-medium text-xl">Группы</p>
                      <div className="flex flex-col gap-2">
                        {groups.map((group) => (
                          <div
                            key={group.id}
                            className={`rounded-lg hover:bg-white shadow-custom-hover ${expandedGroups.has(group.id) && 'bg-white shadow-md'}`}
                          >
                            <div
                              className="flex items-center justify-between px-3.75 py-3 cursor-pointer transition-all"
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
                                <span className="text-[#202020]">
                                  {group.name}
                                </span>
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
                                      className="icon-gray"
                                      width={20}
                                      height={20}
                                    />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenGroupRename(true);
                                      setSelectedGroup(group);
                                    }}
                                    className="cursor-pointer"
                                    title="Переименовать"
                                  >
                                    <Image
                                      alt="rename"
                                      src="/rename-gray.svg"
                                      className="icon-gray"
                                      width={20}
                                      height={20}
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
                                      className="icon-gray"
                                      width={20}
                                      height={20}
                                    />
                                  </button>
                                </div>
                              )}
                            </div>
                            {expandedGroups.has(group.id) &&
                              group.templates && (
                                <div className="mt-0.75 mb-3.75 flex flex-col gap-3.75 mx-3.75">
                                  {group.templates.length > 0 ? (
                                    <>
                                      {group.templates.map((template) => (
                                        <div
                                          key={template.id}
                                          className={`px-3.75 py-3 rounded-lg cursor-pointer transition-all hover:bg-white shadow-custom-hover  ${
                                            selectedTemplate?.id ===
                                              template.id &&
                                            'bg-white shadow-md'
                                          }`}
                                          onMouseEnter={() =>
                                            setHoveredItem(
                                              `template-${template.id}`,
                                            )
                                          }
                                          onMouseLeave={() =>
                                            setHoveredItem(null)
                                          }
                                          onClick={() =>
                                            handleSelectTemplate(template)
                                          }
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
                                  ) : (
                                    <p className="px-3.75 py-3 text-sm text-[#6C757D]">
                                      Шаблонов пока нет
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {templates.length > 0 && (
                    <div>
                      <p className="text-medium text-xl">Шаблоны без группы</p>

                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className={`px-3.75 py-3 rounded-lg cursor-pointer hover:bg-white shadow-custom-hover transition-all ${
                            selectedTemplate?.id === template.id &&
                            'bg-white shadow-md'
                          }`}
                          onMouseEnter={() =>
                            setHoveredItem(`template-${template.id}`)
                          }
                          onMouseLeave={() => setHoveredItem(null)}
                          onClick={() => handleSelectTemplate(template)}
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
              )}
            </div>

            <div className="flex-1">
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="mt-2.5 mr-2.5 cursor-pointer transition-colors"
                >
                  <Image alt="close" src="/close.svg" width={25} height={25} />
                </button>
              </div>

              {templateLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    Загрузка шаблона...
                  </div>
                </div>
              ) : selectedTemplate ? (
                <div>
                  <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-md px-2.5 py-1.25 rounded-full ${
                          selectedTemplate.type === 'personal'
                            ? 'bg-[#FFD6BF]'
                            : 'bg-[#CFE5E6]'
                        }`}
                      >
                        {selectedTemplate.type === 'personal'
                          ? 'Личный'
                          : 'Общий'}
                      </span>
                      <h3 className="text-3xl font-medium text-[#202020]">
                        {selectedTemplate.name}
                      </h3>
                    </div>
                    <div className="flex items-center w-91.25 justify-end gap-2">
                      <div className="relative h-8.5">
                        <button
                          className="h-8.5 cursor-pointer"
                          title="Другие действия"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(
                              openMenuId === selectedTemplate.id
                                ? null
                                : selectedTemplate.id,
                            );
                          }}
                        >
                          <Image
                            alt="more"
                            src="/more.svg"
                            className="icon-gray"
                            width={34}
                            height={34}
                          />
                        </button>
                        {openMenuId === selectedTemplate.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border-0 rounded-lg shadow-lg p-1.5 z-10 template-actions-menu min-w-37.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenEdit(true);
                                handleEditConfirm();
                              }}
                              className="w-full px-4 py-2 text-left text-sm rounded-md cursor-pointer hover:bg-[#F0F5FF] transition-colors"
                            >
                              Редактировать
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenRename(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm rounded-md cursor-pointer hover:bg-[#F0F5FF] transition-colors"
                            >
                              Переименовать
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMove(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm rounded-md cursor-pointer hover:bg-[#F0F5FF] transition-colors"
                            >
                              Переместить
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteTemplate(
                                  selectedTemplate.id,
                                  selectedTemplate.name,
                                );
                              }}
                              className="w-full px-4 py-2 text-left text-sm rounded-md cursor-pointer hover:bg-[#F0F5FF] transition-colors"
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleApply}
                        className="px-6 py-2 h-9.5 bg-[#5D8CF1] cursor-pointer text-white rounded-lg hover:bg-[#769CEF] transition-colors"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                  <div
                    onDoubleClick={handleDoubleClick}
                    className="py-5.25 pl-14 pr-8 flex flex-col gap-9"
                  >
                    {selectedTemplate.content &&
                      Object.entries(selectedTemplate.content).map(
                        ([sectionKey, value]) => {
                          const sectionLabel =
                            PROTOCOL_SECTIONS.find((s) => s.key === sectionKey)
                              ?.label || sectionKey;
                          if (!value) return null;
                          return (
                            <div
                              key={sectionKey}
                              className="flex flex-col gap-3"
                            >
                              <h4 className="text-3xl font-medium text-[#202020]">
                                {sectionLabel}
                              </h4>
                              <p className="text-md whitespace-pre-wrap">
                                {value}
                              </p>
                            </div>
                          );
                        },
                      )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Выберите шаблон для просмотра
                </div>
              )}
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
      <EditTemplatePopup
        isOpen={showEditConfirm}
        onClose={() => setShowEditConfirm(false)}
        onEdit={handleEditConfirm}
      />
      <RenameTemplate
        key={selectedTemplate?.id}
        onRename={async (newName) => {
          if (!selectedTemplate) {
            setOpenRename(false);
            return;
          }
          await handleRename(selectedTemplate.id, 'template', newName);
        }}
        isOpen={openRename && selectedTemplate !== null}
        onClose={() => setOpenRename(false)}
        templateName={selectedTemplate?.name || ''}
      />
      <RenameGroup
        key={selectedGroup?.id}
        onRename={async (newName) => {
          if (!selectedGroup) {
            setOpenGroupRename(false);
            return;
          }
          await handleRename(selectedGroup.id, 'group', newName);
        }}
        isOpen={openGroupRename && selectedGroup !== null}
        onClose={() => setOpenGroupRename(false)}
        groupName={selectedGroup?.name || ''}
      />
      <MoveTemplatePopup
        isOpen={openMove}
        templateId={selectedTemplate?.id || null}
        onClose={() => setOpenMove(false)}
        onSuccess={loadTemplates}
      />
      <EditTemplateContentPopup
        isOpen={showEditContentPopup}
        template={editingTemplate}
        onClose={() => {
          setShowEditContentPopup(false);
          setEditingTemplate(null);
        }}
        onSuccess={handleTemplateUpdated}
      />
    </>
  );
};
