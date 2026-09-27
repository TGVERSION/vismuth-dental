'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import type { DropdownOption } from '../CustomDropdown';
import type {
  ProtocolStructures,
  ProtocolFcieldsMain,
  ProtocolStructuresPost,
  StructureProtocolsFieldsSmall,
  DictionaryNames,
} from '@/api';
import { FieldRow } from './structures/FieldRow';
import { FieldPickerDropdown } from './structures/FieldPickerDropdown';
import {
  isOptionsType,
  parseOptions,
  serializeOptions,
  slugify,
  uid,
  type LocalField,
} from './structures/field-model';

export function ProtocolStructuresSection({
  onPopupClose,
  externalCloseRef,
}: {
  onPopupClose?: () => void;
  externalCloseRef?: React.MutableRefObject<(() => void) | null>;
} = {}) {
  const [view, setView] = useState<'list' | 'editor'>('list');

  const [structures, setStructures] = useState<ProtocolStructures[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [structureName, setStructureName] = useState('');
  const [structureCode, setStructureCode] = useState('');
  const [fields, setFields] = useState<LocalField[]>([]);
  const [expandedLocalId, setExpandedLocalId] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const isDirtyRef = useRef(false);
  const pendingCloseTypeRef = useRef<'back' | 'popup'>('back');
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);

  const handleBack = () => {
    if (isDirtyRef.current) {
      pendingCloseTypeRef.current = 'back';
      setShowConfirmClose(true);
    } else {
      setView('list');
    }
  };

  useEffect(() => {
    if (!externalCloseRef) return;
    externalCloseRef.current = () => {
      if (view !== 'editor' || !isDirtyRef.current) {
        onPopupClose?.();
        return;
      }
      pendingCloseTypeRef.current = 'popup';
      setShowConfirmClose(true);
    };
  }, [view, externalCloseRef, onPopupClose]);

  const [draggedLocalId, setDraggedLocalId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    localId: string;
    side: 'before' | 'after';
  } | null>(null);

  const handleDrop = () => {
    if (!draggedLocalId || !dropTarget) return;
    isDirtyRef.current = true;
    const { localId: targetLocalId, side } = dropTarget;
    if (draggedLocalId !== targetLocalId) {
      setFields((prev) => {
        const srcIdx = prev.findIndex((f) => f.localId === draggedLocalId);
        if (srcIdx < 0) return prev;
        const next = [...prev];
        const [removed] = next.splice(srcIdx, 1);
        const tgtIdx = next.findIndex((f) => f.localId === targetLocalId);
        if (tgtIdx < 0) return next;
        next.splice(side === 'before' ? tgtIdx : tgtIdx + 1, 0, removed);
        return next;
      });
    }
    setDraggedLocalId(null);
    setDropTarget(null);
  };

  const [mainFields, setMainFields] = useState<ProtocolFcieldsMain[]>([]);
  const [dictionaries, setDictionaries] = useState<DictionaryNames[]>([]);

  const dictionaryOptions: DropdownOption<string>[] = dictionaries.map((d) => ({
    value: d.name,
    label: d.name,
  }));

  const loadStructures = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const data = await mainApi.protocol_structures.getProtocolStructures();
      setStructures(data);
    } catch {
      toast.error('Не удалось загрузить структуры');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadMainFields = useCallback(async () => {
    try {
      const data = await mainApi.protocol_fields_main.getProtocolFcieldsMain();
      setMainFields(data);
    } catch {
      // non-critical
    }
  }, []);

  const loadDictionaries = useCallback(async () => {
    try {
      const data = await mainApi.dictionary.getDictionary();
      setDictionaries(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadStructures();
    loadMainFields();
    loadDictionaries();
  }, [loadStructures, loadMainFields, loadDictionaries]);

  const openEditor = async (structure: ProtocolStructures) => {
    try {
      const detail =
        await mainApi.protocol_structures.getProtocolStructuresById(
          structure.id,
        );
      setEditingId(structure.id);
      setCurrentVersion(detail.version);
      setStructureName(detail.structure_name);
      setStructureCode(detail.structure_code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailFields = (detail.fields || []) as any[];
      setFields(
        detailFields
          .sort(
            (a: { sort_order: number }, b: { sort_order: number }) =>
              a.sort_order - b.sort_order,
          )
          .map(
            (f: {
              id: string;
              field_name: string;
              field_label: string | null;
              field_type: string;
              default_value: string | null;
              default_value_jsonb: unknown;
              dictionary: string | null;
              protocol_fields_main_id: string | null;
              is_required: boolean;
              sort_order: number;
            }) => ({
              localId: uid(),
              id: f.id,
              field_name: f.field_name,
              field_label: f.field_label || '',
              field_type: f.field_type,
              default_value: f.default_value,
              default_value_jsonb: f.default_value_jsonb,
              dictionary: f.dictionary,
              protocol_fields_main_id: f.protocol_fields_main_id,
              is_required: f.is_required,
              sort_order: f.sort_order,
              options: parseOptions(f.default_value_jsonb, f.field_type),
            }),
          ),
      );
      setExpandedLocalId(null);
      isDirtyRef.current = false;
      setView('editor');
    } catch {
      toast.error('Не удалось загрузить структуру');
    }
  };

  const createNew = () => {
    setEditingId(null);
    setCurrentVersion(1);
    setStructureName('');
    setStructureCode('');
    setFields([]);
    setExpandedLocalId(null);
    isDirtyRef.current = false;
    setView('editor');
  };

  const save = async (afterSuccess?: () => void) => {
    if (!structureName.trim()) {
      toast.error('Введите название структуры');
      return;
    }

    const code = structureCode || slugify(structureName);
    const usedNames = new Set<string>();
    const apiFields: StructureProtocolsFieldsSmall[] = fields.map((f, i) => {
      const baseName =
        f.field_name ||
        (f.field_label ? slugify(f.field_label) : `field_${i}`);
      let name = baseName;
      if (usedNames.has(name)) {
        let counter = 2;
        while (usedNames.has(`${baseName}_${counter}`)) counter++;
        name = `${baseName}_${counter}`;
      }
      usedNames.add(name);
      return {
        field_name: name,
        field_label: f.field_label || null,
        description: null,
        field_type: f.field_type,
        default_value: isOptionsType(f.field_type) ? null : f.default_value,
        default_value_jsonb: isOptionsType(f.field_type)
          ? serializeOptions(f.options, f.field_type)
          : null,
        dictionary: f.dictionary || null,
        protocol_fields_main_id: f.protocol_fields_main_id || null,
        is_required: f.is_required,
        sort_order: i,
      };
    });

    const body: ProtocolStructuresPost = {
      structure_code: code,
      structure_name: structureName,
      description: '',
      version: editingId ? currentVersion + 1 : 1,
      is_active: true,
      fields: apiFields,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await mainApi.protocol_structures.updateProtocolStructuresById(
          editingId,
          body,
        );
        toast.success('Структура обновлена');
      } else {
        await mainApi.protocol_structures.postProtocolStructures(body as never);
        toast.success('Структура создана');
      }
      isDirtyRef.current = false;
      await loadStructures();
      if (afterSuccess) {
        afterSuccess();
      } else {
        setView('list');
      }
    } catch {
      toast.error('Не удалось сохранить структуру');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteStructure = async (id: string) => {
    try {
      await mainApi.protocol_structures.delete(id);
      toast.success('Структура удалена');
      setStructures((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error('Не удалось удалить структуру');
    }
  };

  const moveField = (localId: string, dir: 'up' | 'down') => {
    isDirtyRef.current = true;
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.localId === localId);
      if (idx < 0) return prev;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const removeField = (localId: string) => {
    isDirtyRef.current = true;
    setFields((prev) => prev.filter((f) => f.localId !== localId));
    if (expandedLocalId === localId) setExpandedLocalId(null);
  };

  const updateField = (localId: string, updates: Partial<LocalField>) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) => (f.localId === localId ? { ...f, ...updates } : f)),
    );
  };

  const addOption = (fieldLocalId: string) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? {
              ...f,
              options: [
                ...f.options,
                { localId: uid(), text: '', isDefault: false },
              ],
            }
          : f,
      ),
    );
  };

  const updateOption = (
    fieldLocalId: string,
    optLocalId: string,
    text: string,
  ) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? {
              ...f,
              options: f.options.map((o) =>
                o.localId === optLocalId ? { ...o, text } : o,
              ),
            }
          : f,
      ),
    );
  };

  const deleteOption = (fieldLocalId: string, optLocalId: string) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? { ...f, options: f.options.filter((o) => o.localId !== optLocalId) }
          : f,
      ),
    );
  };

  const setDefaultOption = (fieldLocalId: string, optLocalId: string) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? {
              ...f,
              options: f.options.map((o) => ({
                ...o,
                isDefault: o.localId === optLocalId,
              })),
            }
          : f,
      ),
    );
  };

  const clearDefaultOption = (fieldLocalId: string) => {
    isDirtyRef.current = true;
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? {
              ...f,
              options: f.options.map((o) => ({ ...o, isDefault: false })),
            }
          : f,
      ),
    );
  };

  const addPresetField = (mainField: ProtocolFcieldsMain) => {
    if (fields.some((f) => f.protocol_fields_main_id === mainField.id)) {
      toast.info('Это поле уже добавлено');
      return;
    }
    isDirtyRef.current = true;
    setFields((prev) => [
      ...prev,
      {
        localId: uid(),
        field_name:
          mainField.field_name || slugify(mainField.field_label || ''),
        field_label: mainField.field_label || mainField.field_name || '',
        field_type: 'text',
        default_value: null,
        default_value_jsonb: null,
        dictionary: null,
        protocol_fields_main_id: mainField.id,
        is_required: false,
        sort_order: prev.length,
        options: [],
      },
    ]);
    setShowFieldPicker(false);
  };

  const addCustomField = () => {
    isDirtyRef.current = true;
    const newField: LocalField = {
      localId: uid(),
      field_name: '',
      field_label: '',
      field_type: 'text',
      default_value: null,
      default_value_jsonb: null,
      dictionary: null,
      protocol_fields_main_id: null,
      is_required: false,
      sort_order: fields.length,
      options: [],
    };
    setFields((prev) => [...prev, newField]);
    setExpandedLocalId(newField.localId);
    setShowFieldPicker(false);
  };

  const addPresetByLabel = (label: string) => {
    const mainField = mainFields.find(
      (f) => f.field_label === label || f.field_name === label,
    );
    if (mainField) {
      addPresetField(mainField);
    } else {
      toast.info(`Поле "${label}" ещё загружается, попробуйте позже`);
    }
  };

  if (view === 'list') {
    return (
      <>
        <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
          <h3 className="text-3xl font-medium text-[#202020]">
            Структуры протоколов
          </h3>
          <button
            type="button"
            onClick={createNew}
            className="px-5 py-2.5 bg-[#5D8CF1] hover:bg-[#769CEF] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Создать новую
          </button>
        </div>

        <div className="px-8 py-5">
          {isLoadingList ? (
            <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
          ) : structures.length === 0 ? (
            <p className="text-sm text-gray-400">Нет структур протоколов</p>
          ) : (
            <div className="flex flex-col gap-2">
              {structures.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-3.75 py-3 rounded-lg cursor-pointer transition-all shadow-custom-hover`}
                  onClick={() => openEditor(s)}
                >
                  <span className="text-sm text-[#202020]">
                    {s.structure_name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteStructure(s.id);
                    }}
                    className="cursor-pointer p-1 hover:opacity-70 transition-opacity"
                    aria-label="Удалить структуру"
                  >
                    <Image
                      src="/delete-gray.svg"
                      alt="delete"
                      width={18}
                      height={18}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-8">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-[#6C757D] hover:text-[#202020] cursor-pointer transition-colors"
        >
          <Image src="/arrow-left.svg" alt="back" width={16} height={16} />
          Назад
        </button>
        <button
          type="button"
          onClick={() => save()}
          disabled={isSaving}
          className="px-5 py-2.5 bg-[#5D8CF1] hover:bg-[#769CEF] disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      <div className="px-8 py-8 overflow-y-auto flex-1">
        <input
          type="text"
          value={structureName}
          onChange={(e) => {
            isDirtyRef.current = true;
            setStructureName(e.target.value);
          }}
          placeholder="Введите название структуры"
          className="text-3xl font-medium text-[#202020] w-full bg-transparent border-none outline-none mb-8 placeholder-gray-300"
        />

        {fields.length === 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            <div className="rounded-[15px] hover:bg-[#F0F5FF] bg-[#DCE7FF]">
              <button
                ref={addFieldBtnRef}
                type="button"
                onClick={() => setShowFieldPicker((v) => !v)}
                className="flex items-center px-3.75 py-3 text-md  text-[#202020] cursor-pointer"
              >
                Все блоки
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mx-auto ">
              {['Жалобы', 'Анамнез заболевания', 'История заболевания'].map(
                (label) => (
                  <div
                    key={label}
                    className="border border-[#DCE7FF] hover:bg-[#DCE7FF] transition-all rounded-[15px]"
                  >
                    <button
                      type="button"
                      onClick={() => addPresetByLabel(label)}
                      className="px-5 py-3.5 text-sm font-medium text-[#202020] cursor-pointer transition-colors"
                    >
                      {label}
                    </button>
                  </div>
                ),
              )}
            </div>
            <div className="border border-[#DCE7FF] hover:bg-[#DCE7FF] transition-all rounded-[15px]">
              <button
                type="button"
                onClick={addCustomField}
                className="px-5 py-3.5 text-sm font-medium text-[#202020] cursor-pointer transition-colors"
              >
                Своё поле
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {fields.map((field, idx) => (
                <Fragment key={field.localId}>
                  {dropTarget?.localId === field.localId &&
                    dropTarget.side === 'before' &&
                    draggedLocalId !== field.localId && (
                      <div className="h-0.5 mx-2 bg-[#5D8CF1] rounded-full" />
                    )}
                  <FieldRow
                    field={field}
                    index={idx}
                    total={fields.length}
                    isExpanded={expandedLocalId === field.localId}
                    onToggle={() =>
                      setExpandedLocalId((prev) =>
                        prev === field.localId ? null : field.localId,
                      )
                    }
                    onMoveUp={() => moveField(field.localId, 'up')}
                    onMoveDown={() => moveField(field.localId, 'down')}
                    onDelete={() => removeField(field.localId)}
                    onUpdate={(updates) => updateField(field.localId, updates)}
                    onAddOption={() => addOption(field.localId)}
                    onUpdateOption={(optId, text) =>
                      updateOption(field.localId, optId, text)
                    }
                    onDeleteOption={(optId) =>
                      deleteOption(field.localId, optId)
                    }
                    onSetDefault={(optId) =>
                      setDefaultOption(field.localId, optId)
                    }
                    onClearDefault={() => clearDefaultOption(field.localId)}
                    dictionaryOptions={dictionaryOptions}
                    isDragging={draggedLocalId === field.localId}
                    onDragStart={() => setDraggedLocalId(field.localId)}
                    onDragOver={(side) =>
                      setDropTarget({ localId: field.localId, side })
                    }
                    onDrop={handleDrop}
                    onDragEnd={() => {
                      setDraggedLocalId(null);
                      setDropTarget(null);
                    }}
                  />
                  {dropTarget?.localId === field.localId &&
                    dropTarget.side === 'after' &&
                    draggedLocalId !== field.localId && (
                      <div className="h-0.5 mx-2 bg-[#5D8CF1] rounded-full" />
                    )}
                </Fragment>
              ))}
            </div>

            <button
              ref={addFieldBtnRef}
              type="button"
              onClick={() => setShowFieldPicker((v) => !v)}
              className="mt-6 w-full py-3.5 rounded-[15px] hover:bg-[#F0F5FF] bg-[#DCE7FF] text-md transition-all cursor-pointer"
            >
              Добавить поле
            </button>
          </>
        )}
      </div>

      {showFieldPicker && (
        <FieldPickerDropdown
          mainFields={mainFields}
          anchorRef={addFieldBtnRef}
          onSelectPreset={addPresetField}
          onSelectCustom={addCustomField}
          onClose={() => setShowFieldPicker(false)}
        />
      )}

      {showConfirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-120 p-10 shadow-2xl flex flex-col gap-5 animate-fade-in">
            <div className="flex flex-col gap-1.5">
              <p className="text-[34px] font-medium text-center mb-5 ">
                Вы действительно хотите закрыть?
              </p>
              <p className="mb-7.5  text-[18px] text-center text-[#6C757D]">
                Ваши изменения не сохранятся.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClose(false);
                  if (pendingCloseTypeRef.current === 'popup') {
                    save(() => onPopupClose?.());
                  } else {
                    save();
                  }
                }}
                disabled={isSaving}
                className="w-full h-12 py-3 bg-[#5D8CF1] hover:bg-[#769CEF] disabled:opacity-60 text-white rounded-xl text-sm transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Сохранить'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClose(false);
                  isDirtyRef.current = false;
                  if (pendingCloseTypeRef.current === 'popup') {
                    onPopupClose?.();
                  } else {
                    setView('list');
                  }
                }}
                className="w-full h-12 py-3 rounded-[15px] hover:bg-[#F0F5FF] bg-[#DCE7FF] text-sm transition-all cursor-pointer"
              >
                Закрыть без сохранения
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
