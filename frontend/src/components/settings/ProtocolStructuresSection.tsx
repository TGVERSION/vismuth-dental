'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import type {
  ProtocolStructures,
  ProtocolFcieldsMain,
  ProtocolStructuresPost,
  StructureProtocolsFieldsSmall,
  DictionaryNames,
} from '@/api';
import { CustomDropdown, DropdownOption } from '../CustomDropdown';
import { RadioButton } from '../RadioButton';
import { Checkbox } from '../Checkbox';

const FIELD_TYPES: DropdownOption<string>[] = [
  { value: 'text', label: 'Текст' },
  { value: 'select', label: 'Выбор одного из списка' },
  { value: 'multiselect', label: 'Множественный выбор из списка' },
  { value: 'radio', label: 'Один вариант выбора (радиокнопки)' },
  { value: 'checkbox', label: 'Несколько вариантов выбора (галочки)' },
];

const getTypeLabel = (type: string) =>
  FIELD_TYPES.find((t) => t.value === type)?.label ?? type;

const isOptionsType = (type: string) => type === 'radio' || type === 'checkbox';

interface LocalOption {
  localId: string;
  text: string;
  isDefault: boolean;
}

interface LocalField {
  localId: string;
  id?: string;
  field_name: string;
  field_label: string;
  field_type: string;
  default_value: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default_value_jsonb: any;
  dictionary: string | null;
  protocol_fields_main_id: string | null;
  is_required: boolean;
  sort_order: number;
  options: LocalOption[];
}

let _counter = 0;
const uid = () => `uid-${++_counter}-${Math.random().toString(36).slice(2, 6)}`;

const slugify = (text: string) =>
  text.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '').slice(0, 100) ||
  `field_${Date.now()}`;

function parseOptions(jsonb: unknown, fieldType?: string): LocalOption[] {
  if (!jsonb || typeof jsonb !== 'object') return [];
  const data = jsonb as {
    options?: unknown;
    default?: string | null;
    defaults?: string[] | null;
  };
  if (!Array.isArray(data.options)) return [];
  if (fieldType === 'checkbox' && Array.isArray(data.defaults)) {
    return (data.options as string[]).map((text) => ({
      localId: uid(),
      text: String(text),
      isDefault: data.defaults!.includes(text),
    }));
  }
  return (data.options as string[]).map((text) => ({
    localId: uid(),
    text: String(text),
    isDefault: data.default === text,
  }));
}

function serializeOptions(options: LocalOption[], fieldType?: string) {
  if (!options.length) return null;
  if (fieldType === 'checkbox') {
    const defaults = options.filter((o) => o.isDefault).map((o) => o.text);
    return {
      options: options.map((o) => o.text),
      defaults: defaults.length ? defaults : null,
    };
  }
  const def = options.find((o) => o.isDefault);
  return { options: options.map((o) => o.text), default: def?.text ?? null };
}

function FieldRow({
  field,
  index,
  total,
  isExpanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdate,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onSetDefault,
  onClearDefault,
  dictionaryOptions,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  field: LocalField;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<LocalField>) => void;
  onAddOption: () => void;
  onUpdateOption: (optId: string, text: string) => void;
  onDeleteOption: (optId: string) => void;
  onSetDefault: (optId: string) => void;
  onClearDefault: () => void;
  dictionaryOptions: DropdownOption<string>[];
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (side: 'before' | 'after') => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [dictEntries, setDictEntries] = useState<DropdownOption<string>[]>([]);
  const [draggedOptId, setDraggedOptId] = useState<string | null>(null);
  const [dropOptTarget, setDropOptTarget] = useState<{
    localId: string;
    side: 'before' | 'after';
  } | null>(null);

  const handleOptDrop = () => {
    if (!draggedOptId || !dropOptTarget) return;
    const { localId: targetId, side } = dropOptTarget;
    if (draggedOptId !== targetId) {
      const srcIdx = field.options.findIndex((o) => o.localId === draggedOptId);
      if (srcIdx < 0) return;
      const next = [...field.options];
      const [removed] = next.splice(srcIdx, 1);
      const tgtIdx = next.findIndex((o) => o.localId === targetId);
      if (tgtIdx >= 0)
        next.splice(side === 'before' ? tgtIdx : tgtIdx + 1, 0, removed);
      onUpdate({ options: next });
    }
    setDraggedOptId(null);
    setDropOptTarget(null);
  };

  useEffect(() => {
    if (!isExpanded || !field.dictionary || isOptionsType(field.field_type)) {
      return;
    }
    let cancelled = false;
    mainApi.dictionary
      .getDictionaryRef(field.dictionary, { limit: 200, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        if (!res.items.length) {
          setDictEntries([]);
          return;
        }
        const keys = Object.keys(res.items[0]).filter((k) => k !== 'row_id');
        const firstKey = keys[0];
        if (!firstKey) {
          setDictEntries([]);
          return;
        }
        setDictEntries(
          res.items
            .map((item) => String(item[firstKey] ?? ''))
            .filter(Boolean)
            .map((text) => ({ value: text, label: text })),
        );
      })
      .catch(() => {
        if (!cancelled) setDictEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpanded, field.dictionary, field.field_type]);

  const isPreset = !!field.protocol_fields_main_id;
  const showControls = isHovered || isExpanded;

  return (
    <div
      data-field-row
      className={`rounded-xl transition-all ${
        isDragging
          ? 'opacity-30 border-transparent shadow-none'
          : showControls
            ? 'border-gray-200 shadow-md'
            : 'border-transparent'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const side =
          e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        onDragOver(side);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <div
        className="flex items-center px-3 py-4 cursor-pointer select-none gap-1"
        onClick={onToggle}
      >
        <span
          draggable
          onDragStart={(e) => {
            const rowEl = (e.currentTarget as HTMLElement).closest(
              '[data-field-row]',
            ) as HTMLElement | null;
            if (rowEl) {
              const ghost = rowEl.cloneNode(true) as HTMLElement;
              const rect = rowEl.getBoundingClientRect();
              Object.assign(ghost.style, {
                position: 'fixed',
                top: '-9999px',
                left: '-9999px',
                width: rect.width + 'px',
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                border: '1px solid #E5E7EB',
                pointerEvents: 'none',
              });
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(
                ghost,
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
              setTimeout(() => ghost.remove(), 0);
            }
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
            onDragStart();
          }}
          className={`text-[#9CA3AF] text-xs transition-opacity mr-1 cursor-grab active:cursor-grabbing ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Image src="/drag.svg" alt="delete" width={20} height={20} />
        </span>
        <span className="text-md text-[#202020] shrink-0">{index + 1}.</span>
        <span className="text-md font-medium text-[#202020] ml-1">
          {field.field_label || 'Без названия'}
        </span>
        {!isPreset && field.field_type && (
          <span className="ml-1 text-sm text-[#6C757D] truncate">
            &#183;{' '}
            <span className="ml-1 text-sm text-[#6C757D] truncate">
              {getTypeLabel(field.field_type)}
            </span>
          </span>
        )}

        <div
          className={`ml-auto flex items-center gap-1 shrink-0 transition-opacity ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Переместить вверх"
            className="flex items-center justify-center w-6 h-6 text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Image src="/arrow-top.svg" alt="back" width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Переместить вниз"
            className="flex items-center justify-center w-6 h-6 text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Image src="/arrow-bottom.svg" alt="back" width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Удалить поле"
            className="flex items-center justify-center w-6 h-6 cursor-pointer"
          >
            <Image src="/delete-gray.svg" alt="delete" width={20} height={20} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-5 flex flex-col gap-4">
          {isPreset ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#6C757D] mb-1.5">
                    Заголовок поля
                  </label>
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-10">
                    <Image
                      src="/lock.svg"
                      alt="lock"
                      width={13}
                      height={13}
                      className="opacity-40 shrink-0"
                    />
                    <span className="text-sm text-[#202020] truncate">
                      {field.field_label}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6C757D] mb-1.5">
                    Справочник для поля
                  </label>
                  <CustomDropdown
                    options={dictionaryOptions}
                    value={field.dictionary || ''}
                    onChange={(v) => onUpdate({ dictionary: v || null })}
                    placeholder="Не выбран"
                    showCheckIcon
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#6C757D] mb-1.5">
                    Заголовок поля
                  </label>
                  <input
                    type="text"
                    value={field.field_label}
                    onChange={(e) => onUpdate({ field_label: e.target.value })}
                    placeholder="Заголовок поля"
                    className="w-full h-10 px-3 py-2 bg-gray-50 rounded-lg text-sm text-[#202020] border-0 outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6C757D] mb-1.5">
                    Тип поля
                  </label>
                  <CustomDropdown
                    options={FIELD_TYPES}
                    value={field.field_type}
                    onChange={(v) => onUpdate({ field_type: v, options: [] })}
                    showCheckIcon
                  />
                </div>
              </div>

              {!isOptionsType(field.field_type) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#6C757D] mb-1.5">
                      Справочник для поля
                    </label>
                    <CustomDropdown
                      options={dictionaryOptions}
                      value={field.dictionary || ''}
                      onChange={(v) => onUpdate({ dictionary: v || null })}
                      placeholder="Не выбран"
                      showCheckIcon
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6C757D] mb-1.5">
                      Значение по умолчанию
                    </label>
                    {field.field_type === 'multiselect' &&
                    field.dictionary &&
                    dictEntries.length > 0 ? (
                      <CustomDropdown<string, true>
                        options={dictEntries}
                        value={
                          field.default_value
                            ? field.default_value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : []
                        }
                        onChange={(v) =>
                          onUpdate({
                            default_value: v.length ? v.join(',') : null,
                          })
                        }
                        placeholder="Не выбрано"
                        showCheckIcon
                        multiple={true}
                      />
                    ) : field.field_type === 'select' &&
                      field.dictionary &&
                      dictEntries.length > 0 ? (
                      <CustomDropdown
                        options={[
                          { value: '', label: 'Не выбрано' },
                          ...dictEntries,
                        ]}
                        value={field.default_value || ''}
                        onChange={(v) => onUpdate({ default_value: v || null })}
                        placeholder="Не выбрано"
                        showCheckIcon
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.default_value || ''}
                        onChange={(e) =>
                          onUpdate({ default_value: e.target.value || null })
                        }
                        placeholder="Введите значение"
                        className="w-full h-10 px-3 py-2 bg-gray-50 rounded-lg text-sm text-[#202020] border-0 outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-shadow"
                      />
                    )}
                  </div>
                </div>
              )}

              {isOptionsType(field.field_type) && (
                <div className="flex flex-col gap-1">
                  {field.options.map((opt) => (
                    <Fragment key={opt.localId}>
                      {dropOptTarget?.localId === opt.localId &&
                        dropOptTarget.side === 'before' &&
                        draggedOptId !== opt.localId && (
                          <div className="h-0.5 mx-2 bg-[#5D8CF1] rounded-full" />
                        )}
                      <div
                        className={`flex items-center gap-2 py-1.5 transition-opacity ${
                          draggedOptId === opt.localId ? 'opacity-30' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropOptTarget({
                            localId: opt.localId,
                            side:
                              e.clientY < rect.top + rect.height / 2
                                ? 'before'
                                : 'after',
                          });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleOptDrop();
                        }}
                        onDragEnd={() => {
                          setDraggedOptId(null);
                          setDropOptTarget(null);
                        }}
                      >
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedOptId(opt.localId);
                          }}
                          className="text-[#9CA3AF] text-xs cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <Image
                            src="/drag.svg"
                            alt="delete"
                            width={20}
                            height={20}
                          />
                        </span>

                        {field.field_type === 'radio' ? (
                          <RadioButton
                            id={opt.localId}
                            name={field.localId}
                            checked={opt.isDefault}
                            onChange={() => onSetDefault(opt.localId)}
                            value={opt.text}
                          />
                        ) : (
                          <Checkbox
                            id={opt.localId}
                            checked={opt.isDefault}
                            onChange={(checked) =>
                              onUpdate({
                                options: field.options.map((o) =>
                                  o.localId === opt.localId
                                    ? { ...o, isDefault: checked }
                                    : o,
                                ),
                              })
                            }
                          />
                        )}

                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) =>
                            onUpdateOption(opt.localId, e.target.value)
                          }
                          placeholder="Введите текст"
                          className="flex-1 h-8 px-3 bg-gray-50 rounded-lg text-sm text-[#202020] border-0 outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-shadow"
                        />

                        {opt.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              if (field.field_type === 'checkbox') {
                                onUpdate({
                                  options: field.options.map((o) =>
                                    o.localId === opt.localId
                                      ? { ...o, isDefault: false }
                                      : o,
                                  ),
                                });
                              } else {
                                onClearDefault();
                              }
                            }}
                            className="flex items-center gap-1 text-xs text-[#6C757D] shrink-0 cursor-pointer"
                          >
                            по умолчанию
                            <span className="text-[#9CA3AF]">✕</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteOption(opt.localId)}
                          className="shrink-0 cursor-pointer"
                        >
                          <Image
                            src="/delete-gray.svg"
                            alt="delete"
                            width={14}
                            height={14}
                          />
                        </button>
                      </div>
                      {dropOptTarget?.localId === opt.localId &&
                        dropOptTarget.side === 'after' &&
                        draggedOptId !== opt.localId && (
                          <div className="h-0.5 mx-2 bg-[#5D8CF1] rounded-full" />
                        )}
                    </Fragment>
                  ))}
                  <div className="flex items-center gap-3 py-1.5">
                    {field.field_type === 'radio' ? (
                      <RadioButton
                        id={`placeholder-${field.localId}`}
                        name={`placeholder-${field.localId}`}
                        checked={false}
                        onChange={() => {}}
                        disabled
                      />
                    ) : (
                      <Checkbox
                        id={`placeholder-${field.localId}`}
                        checked={false}
                        onChange={() => {}}
                        disabled
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Введите текст"
                      readOnly
                      onClick={onAddOption}
                      className="flex-1 h-8 px-3 bg-gray-50 rounded-lg text-sm text-gray-400 border-0 outline-none cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={onAddOption}
                      className="shrink-0 w-6 h-6 flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] cursor-pointer text-lg transition-colors"
                      title="Добавить вариант"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FieldPickerDropdown({
  mainFields,
  anchorRef,
  onSelectPreset,
  onSelectCustom,
  onClose,
}: {
  mainFields: ProtocolFcieldsMain[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelectPreset: (f: ProtocolFcieldsMain) => void;
  onSelectCustom: () => void;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceAbove >= spaceBelow) {
      setStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(spaceAbove - gap * 2, 420),
        zIndex: 9999,
      });
    } else {
      setStyle({
        position: 'fixed',
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(spaceBelow - gap * 2, 420),
        zIndex: 9999,
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  const dropdown = (
    <div
      ref={dropdownRef}
      style={style}
      className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-y-auto animate-fade-in"
    >
      {mainFields.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs text-[#6C757D]">Готовые поля</span>
          </div>
          {mainFields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectPreset(f)}
              className="w-full py-3 px-6 text-left text-sm text-[#202020] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {f.field_label || f.field_name}
            </button>
          ))}
          <div className="mx-4 border-b border-gray-100" />
        </>
      )}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs text-[#6C757D]">Другое</span>
      </div>
      <button
        type="button"
        onClick={onSelectCustom}
        className="w-full py-3 px-6 text-left text-sm text-[#202020] hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Своё поле
      </button>
    </div>
  );

  return createPortal(dropdown, document.body);
}

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
    const apiFields: StructureProtocolsFieldsSmall[] = fields.map((f, i) => ({
      field_name: f.field_name || slugify(f.field_label) || `field_${i}`,
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
    }));

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
