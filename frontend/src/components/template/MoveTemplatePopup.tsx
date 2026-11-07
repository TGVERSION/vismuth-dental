'use client';

import { useState, useEffect } from 'react';
import { mainApi } from '@/api';
import type { ListsGroupsResponse, TemplatesResponse } from '@/api';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { CreateGroupPopup } from '../groups/CreateGroupPopup';
import { logError } from '@/lib/logger';

interface MoveTemplatePopupProps {
  isOpen: boolean;
  templateId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MoveTemplatePopup: React.FC<MoveTemplatePopupProps> = ({
  isOpen,
  templateId,
  onClose,
  onSuccess,
}) => {
  //useLockBodyScroll(isOpen);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groups, setGroups] = useState<ListsGroupsResponse[]>([]);
  const [template, setTemplate] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);

  useEffect(() => {
    if (isOpen && templateId) {
      loadData();
    } else {
      setSelectedGroupId('');
      setTemplate(null);
      setGroups([]);
    }
    // loadData объявлена ниже и пересоздаётся каждый рендер; вынос в
    // useCallback — задача F-3.3 (декомпозиция попапов).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, templateId]);

  const loadData = async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const [groupsRes, templateRes] = await Promise.all([
        mainApi.templateGroups.getGroups(),
        mainApi.templates.getTemplate(templateId),
      ]);

      setGroups(groupsRes || []);
      if (templateRes) {
        setTemplate(templateRes);
        setSelectedGroupId(templateRes.group_id || '');
      }
    } catch (error) {
      logError('Ошибка загрузки данных:', error);
      toast.error('Не удалось загрузить данные', {
        position: 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!templateId || !template) return;
    setSaving(true);
    try {
      await mainApi.templates.update(templateId, {
        protocol_name: template.protocol_name,
        group_id: selectedGroupId || null,
        privacy: template.privacy as 'general' | 'personal' | null,
        fields: (template.fields || []).map((f) => ({
          field_name: f.field_name ?? '',
          field_type: f.field_type ?? 'text',
          field_value: f.field_value,
        })),
        protocol_structure_id: template.protocol_structure_id,
      });

      toast.success('Шаблон успешно перемещён', {
        position: 'top-right',
        autoClose: 3000,
      });
      onSuccess();
      onClose();
    } catch (error) {
      logError('Ошибка перемещения шаблона:', error);
      toast.error('Не удалось переместить шаблон', {
        position: 'top-right',
        autoClose: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedGroupId('');
    onClose();
  };

  const handleGroupCreated = async (groupId: string) => {
    setSelectedGroupId(groupId);
    try {
      const res = await mainApi.templateGroups.getGroups();
      setGroups(res || []);
    } catch (err) {
      logError('Ошибка обновления списка групп:', err);
    }
    setShowCreateGroupPopup(false);
  };

  const sortedGroups = [...groups].sort((a, b) =>
    (a.group_name || '').localeCompare(b.group_name || ''),
  );

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
              onClick={handleClose}
              className="vismuth-icon-button cursor-pointer"
            >
              <Image alt="close" src="/close.svg" width={25} height={25} />
            </button>
          </div>

          <h2 className="text-[length:var(--ui-font-size-31)] font-medium mb-[var(--ui-space-32)] px-5">
            Переместить шаблон
          </h2>

          {loading ? (
            <div className="p-5 text-center text-gray-500">
              Загрузка данных...
            </div>
          ) : (
            <>
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
                      name="move-group"
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
                        {group.group_name}
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
                        name="move-group"
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
                  onClick={handleSave}
                  disabled={saving}
                  className="vismuth-button bg-[var(--ui-color-blue-600)] text-white cursor-pointer hover:bg-[var(--ui-color-blue-700)] transition-colors disabled:opacity-50"
                  data-variant="primary"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="vismuth-button hover:bg-[var(--ui-color-blue-50)] cursor-pointer bg-[var(--ui-color-blue-100)] transition-colors disabled:opacity-50"
                  data-variant="secondary"
                >
                  Отменить
                </button>
              </div>
            </>
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
