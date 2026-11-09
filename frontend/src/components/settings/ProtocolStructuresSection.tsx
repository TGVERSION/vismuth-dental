'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import type { DropdownOption } from '../CustomDropdown';
import type {
  ProtocolStructures,
  ProtocolFcieldsMain,
  DictionaryNames,
} from '@/api';
import { FieldRow } from './structures/FieldRow';
import { FieldPickerDropdown } from './structures/FieldPickerDropdown';
import {
  parseOptions,
  slugify,
  uid,
  type LocalField,
} from './structures/field-model';
import { useStructureAutosave } from './structures/useStructureAutosave';

export function ProtocolStructuresSection({
  onPopupClose,
  externalCloseRef,
}: {
  onPopupClose?: () => void;
  externalCloseRef?: React.MutableRefObject<
    ((afterClose?: () => void) => void) | null
  >;
} = {}) {
  const [view, setView] = useState<'list' | 'editor'>('list');

  const [structures, setStructures] = useState<ProtocolStructures[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [structureName, setStructureName] = useState('');
  const [fields, setFields] = useState<LocalField[]>([]);
  const [expandedLocalId, setExpandedLocalId] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);
  const autosave = useStructureAutosave(
    { name: structureName, fields },
    view === 'editor',
  );
  const { initialize, saveNow } = autosave;

  const leaveEditor = useCallback(
    async (afterClose: () => void) => {
      if (view === 'editor' && !(await saveNow())) return;
      afterClose();
    },
    [view, saveNow],
  );
  const handleBack = () => {
    void leaveEditor(() => {
      setView('list');
      void loadStructures();
    });
  };

  useEffect(() => {
    if (!externalCloseRef) return;
    externalCloseRef.current = (afterClose) => {
      void leaveEditor(afterClose || (() => onPopupClose?.()));
    };
    return () => {
      externalCloseRef.current = null;
    };
  }, [externalCloseRef, leaveEditor, onPopupClose]);

  const [draggedLocalId, setDraggedLocalId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    localId: string;
    side: 'before' | 'after';
  } | null>(null);

  const handleDrop = () => {
    if (!draggedLocalId || !dropTarget) return;
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
      setStructureName(detail.structure_name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailFields = (detail.fields || []) as any[];
      const localFields = detailFields
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
        );
      setFields(localFields);
      initialize(detail, { name: detail.structure_name, fields: localFields });
      setExpandedLocalId(null);
      setView('editor');
    } catch {
      toast.error('Не удалось загрузить структуру');
    }
  };

  const createNew = () => {
    setStructureName('');
    setFields([]);
    initialize(null, { name: '', fields: [] });
    setExpandedLocalId(null);
    setView('editor');
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
    setFields((prev) => prev.filter((f) => f.localId !== localId));
    if (expandedLocalId === localId) setExpandedLocalId(null);
  };

  const updateField = (localId: string, updates: Partial<LocalField>) => {
    setFields((prev) =>
      prev.map((f) => (f.localId === localId ? { ...f, ...updates } : f)),
    );
  };

  const addOption = (fieldLocalId: string) => {
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
    setFields((prev) =>
      prev.map((f) =>
        f.localId === fieldLocalId
          ? { ...f, options: f.options.filter((o) => o.localId !== optLocalId) }
          : f,
      ),
    );
  };

  const setDefaultOption = (fieldLocalId: string, optLocalId: string) => {
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
          <h3 className="text-3xl font-medium text-[var(--ui-color-alabaster-dark-800)]">
            Структуры протоколов
          </h3>
          <button
            type="button"
            onClick={createNew}
            className="vismuth-button vismuth-button--primary"
          >
            Создать новую
          </button>
        </div>

        <div className="px-8 py-5">
          {isLoadingList ? (
            <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[var(--ui-color-blue-600)]"></div>
          ) : structures.length === 0 ? (
            <p className="text-sm text-gray-400">Нет структур протоколов</p>
          ) : (
            <div className="flex flex-col gap-2">
              {structures.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-[var(--ui-space-14)] py-3 rounded-lg cursor-pointer transition-all shadow-custom-hover`}
                  onClick={() => openEditor(s)}
                >
                  <span className="text-sm text-[var(--ui-color-alabaster-dark-800)]">
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
          className="flex items-center gap-2 text-sm text-[var(--ui-color-alabaster-950)] hover:text-[var(--ui-color-alabaster-dark-800)] cursor-pointer transition-colors"
        >
          <Image src="/arrow-left.svg" alt="back" width={16} height={16} />
          Назад
        </button>
        <div className="flex items-center gap-3 text-sm" aria-live="polite">
          <span
            role={autosave.status === 'error' ? 'alert' : 'status'}
            className={
              autosave.status === 'error' || autosave.status === 'invalid'
                ? 'text-red-600'
                : 'text-gray-500'
            }
          >
            {autosave.status === 'saving'
              ? 'Применяется…'
              : autosave.status === 'pending'
                ? 'Изменения применяются автоматически'
                : autosave.status === 'error'
                  ? 'Не удалось применить изменения'
                  : autosave.status === 'invalid'
                    ? 'Введите название структуры'
                    : 'Изменения применены'}
          </span>
          {(autosave.status === 'error' || autosave.status === 'invalid') && (
            <>
              {autosave.status === 'error' && (
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => void saveNow()}
                >
                  Повторить
                </button>
              )}
              <button
                type="button"
                className="text-gray-500"
                onClick={() => {
                  const restored = autosave.discardChanges();
                  setStructureName(restored.name);
                  setFields(restored.fields);
                  setView('list');
                  void loadStructures();
                }}
              >
                Вернуться к списку
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-8 py-8 overflow-y-auto flex-1">
        <input
          type="text"
          value={structureName}
          onChange={(e) => {
            setStructureName(e.target.value);
          }}
          placeholder="Введите название структуры"
          className="text-3xl font-medium text-[var(--ui-color-alabaster-dark-800)] w-full bg-transparent border-none outline-none mb-8 placeholder-gray-300"
        />

        {fields.length === 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            <div className="rounded-2xl hover:bg-[var(--ui-color-blue-50)] bg-[var(--ui-color-blue-100)]">
              <button
                ref={addFieldBtnRef}
                type="button"
                onClick={() => setShowFieldPicker((v) => !v)}
                className="flex items-center px-[var(--ui-space-14)] py-3 text-md  text-[var(--ui-color-alabaster-dark-800)] cursor-pointer"
              >
                Все блоки
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mx-auto ">
              {['Жалобы', 'Анамнез заболевания', 'История заболевания'].map(
                (label) => (
                  <div
                    key={label}
                    className="border border-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-100)] transition-all rounded-2xl"
                  >
                    <button
                      type="button"
                      onClick={() => addPresetByLabel(label)}
                      className="px-5 py-[var(--ui-space-14)] text-sm font-medium text-[var(--ui-color-alabaster-dark-800)] cursor-pointer transition-colors"
                    >
                      {label}
                    </button>
                  </div>
                ),
              )}
            </div>
            <div className="border border-[var(--ui-color-blue-100)] hover:bg-[var(--ui-color-blue-100)] transition-all rounded-2xl">
              <button
                type="button"
                onClick={addCustomField}
                className="px-5 py-[var(--ui-space-14)] text-sm font-medium text-[var(--ui-color-alabaster-dark-800)] cursor-pointer transition-colors"
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
                      <div className="h-0.5 mx-2 bg-[var(--ui-color-blue-600)] rounded-full" />
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
                      <div className="h-0.5 mx-2 bg-[var(--ui-color-blue-600)] rounded-full" />
                    )}
                </Fragment>
              ))}
            </div>

            <button
              ref={addFieldBtnRef}
              type="button"
              onClick={() => setShowFieldPicker((v) => !v)}
              className="vismuth-button vismuth-button--secondary mt-6 w-full"
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
    </>
  );
}
