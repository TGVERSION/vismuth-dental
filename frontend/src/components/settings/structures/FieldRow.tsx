'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { mainApi } from '@/api';
import { CustomDropdown, type DropdownOption } from '../../CustomDropdown';
import { RadioButton } from '../../RadioButton';
import { Checkbox } from '../../Checkbox';
import {
  DICT_LIMIT,
  extractDictEntries,
  FIELD_TYPES,
  getTypeLabel,
  isOptionsType,
  type LocalField,
} from './field-model';

export function FieldRow({
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
  const [dictSearchInput, setDictSearchInput] = useState('');
  const [dictOffset, setDictOffset] = useState(0);
  const [dictHasMore, setDictHasMore] = useState(false);
  const [dictLoading, setDictLoading] = useState(false);
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
    const delay = dictSearchInput ? 300 : 0;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setDictLoading(true);
      mainApi.dictionary
        .getDictionaryRef(field.dictionary!, {
          search: dictSearchInput || undefined,
          limit: DICT_LIMIT,
          offset: 0,
        })
        .then((res) => {
          if (cancelled) return;
          setDictEntries(extractDictEntries(res.items));
          setDictHasMore(res.offset + res.items.length < res.total);
          setDictOffset(res.items.length);
          setDictLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setDictEntries([]);
            setDictHasMore(false);
            setDictLoading(false);
          }
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isExpanded, field.dictionary, field.field_type, dictSearchInput]);

  const handleDictLoadMore = useCallback(() => {
    if (!field.dictionary || dictLoading || !dictHasMore) return;
    setDictLoading(true);
    mainApi.dictionary
      .getDictionaryRef(field.dictionary, {
        search: dictSearchInput || undefined,
        limit: DICT_LIMIT,
        offset: dictOffset,
      })
      .then((res) => {
        setDictEntries((prev) => [...prev, ...extractDictEntries(res.items)]);
        setDictHasMore(res.offset + res.items.length < res.total);
        setDictOffset((prev) => prev + res.items.length);
      })
      .catch(() => setDictHasMore(false))
      .finally(() => setDictLoading(false));
  }, [field.dictionary, dictLoading, dictHasMore, dictSearchInput, dictOffset]);

  const isPreset = !!field.protocol_fields_main_id;
  const showControls = isHovered || isExpanded;

  return (
    <div
      data-field-row
      className={`rounded-xl transition-all ${
        isDragging
          ? 'opacity-30 border-transparent shadow-none'
          : showControls
            ? 'border-gray-200 shadow-[var(--ui-shadow-md)]'
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
          className={`text-[var(--ui-color-alabaster-800)] text-xs transition-opacity mr-1 cursor-grab active:cursor-grabbing ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Image src="/drag.svg" alt="delete" width={20} height={20} />
        </span>
        <span className="text-md text-[var(--ui-color-alabaster-dark-800)] shrink-0">
          {index + 1}.
        </span>
        <span className="text-md font-medium text-[var(--ui-color-alabaster-dark-800)] ml-1">
          {field.field_label || 'Без названия'}
        </span>
        {!isPreset && field.field_type && (
          <span className="ml-1 text-sm text-[var(--ui-color-alabaster-950)] truncate">
            &#183;{' '}
            <span className="ml-1 text-sm text-[var(--ui-color-alabaster-950)] truncate">
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
            className="flex items-center justify-center w-6 h-6 text-[var(--ui-color-alabaster-800)] hover:text-[var(--ui-color-slate-700)] disabled:opacity-30 transition-colors cursor-pointer"
          >
            <Image src="/arrow-top.svg" alt="back" width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Переместить вниз"
            className="flex items-center justify-center w-6 h-6 text-[var(--ui-color-alabaster-800)] hover:text-[var(--ui-color-slate-700)] disabled:opacity-30 transition-colors cursor-pointer"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
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
                    <span className="text-sm text-[var(--ui-color-alabaster-dark-800)] truncate">
                      {field.field_label}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
                    Справочник для поля
                  </label>
                  <CustomDropdown
                    options={dictionaryOptions}
                    value={field.dictionary || ''}
                    onChange={(v) => {
                      setDictSearchInput('');
                      onUpdate({ dictionary: v || null });
                    }}
                    placeholder="Не выбран"
                    showCheckIcon
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
                    Заголовок поля
                  </label>
                  <input
                    type="text"
                    value={field.field_label}
                    onChange={(e) => onUpdate({ field_label: e.target.value })}
                    placeholder="Заголовок поля"
                    className="vismuth-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
                      Справочник для поля
                    </label>
                    <CustomDropdown
                      options={dictionaryOptions}
                      value={field.dictionary || ''}
                      onChange={(v) => {
                        setDictSearchInput('');
                        onUpdate({ dictionary: v || null });
                      }}
                      placeholder="Не выбран"
                      showCheckIcon
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--ui-color-alabaster-950)] mb-[var(--ui-space-6)]">
                      Значение по умолчанию
                    </label>
                    {field.field_type === 'multiselect' && field.dictionary ? (
                      <CustomDropdown<string, true>
                        key={field.dictionary}
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
                        onSearch={setDictSearchInput}
                        onLoadMore={handleDictLoadMore}
                        hasMore={dictHasMore}
                        isLoading={dictLoading}
                      />
                    ) : field.field_type === 'select' && field.dictionary ? (
                      <CustomDropdown
                        key={field.dictionary}
                        options={[
                          { value: '', label: 'Не выбрано' },
                          ...dictEntries,
                        ]}
                        value={field.default_value || ''}
                        onChange={(v) => onUpdate({ default_value: v || null })}
                        placeholder="Не выбрано"
                        showCheckIcon
                        onSearch={setDictSearchInput}
                        onLoadMore={handleDictLoadMore}
                        hasMore={dictHasMore}
                        isLoading={dictLoading}
                      />
                    ) : field.dictionary ? (
                      <CustomDropdown
                        key={field.dictionary}
                        options={[
                          { value: '', label: 'Не выбрано' },
                          ...dictEntries,
                        ]}
                        value={field.default_value || ''}
                        onChange={(v) => onUpdate({ default_value: v || null })}
                        placeholder="Не выбрано"
                        showCheckIcon
                        onSearch={setDictSearchInput}
                        onLoadMore={handleDictLoadMore}
                        hasMore={dictHasMore}
                        isLoading={dictLoading}
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.default_value || ''}
                        onChange={(e) =>
                          onUpdate({ default_value: e.target.value || null })
                        }
                        placeholder="Сначала выберите справочник"
                        disabled
                        className="vismuth-input w-full"
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
                          <div className="h-0.5 mx-2 bg-[var(--ui-color-blue-600)] rounded-full" />
                        )}
                      <div
                        className={`flex items-center gap-2 py-[var(--ui-space-6)] transition-opacity ${
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
                          className="text-[var(--ui-color-alabaster-800)] text-xs cursor-grab active:cursor-grabbing shrink-0"
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
                          className="flex-1 h-8 px-3 bg-gray-50 rounded-lg text-sm text-[var(--ui-color-alabaster-dark-800)] border-0 outline-none focus:ring-2 focus:ring-[var(--ui-color-blue-600)] transition-shadow"
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
                            className="flex items-center gap-1 text-xs text-[var(--ui-color-alabaster-950)] shrink-0 cursor-pointer"
                          >
                            по умолчанию
                            <span className="text-[var(--ui-color-alabaster-800)]">
                              ✕
                            </span>
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
                          <div className="h-0.5 mx-2 bg-[var(--ui-color-blue-600)] rounded-full" />
                        )}
                    </Fragment>
                  ))}
                  <div className="flex items-center gap-3 py-[var(--ui-space-6)]">
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
                      className="shrink-0 w-6 h-6 flex items-center justify-center text-[var(--ui-color-alabaster-800)] hover:text-[var(--ui-color-slate-700)] cursor-pointer text-lg transition-colors"
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
