'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ProtocolFcieldsMain } from '@/api';

export function FieldPickerDropdown({
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
        zIndex: 'var(--ui-z-popover)',
      });
    } else {
      setStyle({
        position: 'fixed',
        top: rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(spaceBelow - gap * 2, 420),
        zIndex: 'var(--ui-z-popover)',
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
      className="bg-white border border-gray-200 rounded-xl shadow-[var(--ui-shadow-lg)] overflow-y-auto animate-fade-in"
    >
      {mainFields.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs text-[var(--ui-color-alabaster-950)]">
              Готовые поля
            </span>
          </div>
          {mainFields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectPreset(f)}
              className="w-full py-3 px-6 text-left text-sm text-[var(--ui-color-alabaster-dark-800)] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {f.field_label || f.field_name}
            </button>
          ))}
          <div className="mx-4 border-b border-gray-100" />
        </>
      )}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs text-[var(--ui-color-alabaster-950)]">
          Другое
        </span>
      </div>
      <button
        type="button"
        onClick={onSelectCustom}
        className="w-full py-3 px-6 text-left text-sm text-[var(--ui-color-alabaster-dark-800)] hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Своё поле
      </button>
    </div>
  );

  return createPortal(dropdown, document.body);
}
