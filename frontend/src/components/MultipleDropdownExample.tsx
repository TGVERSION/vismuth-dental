'use client';

import { useState } from 'react';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

type HelperType = 'mkb' | 'autocomplete' | 'fullness';

const HELPER_OPTIONS: DropdownOption<HelperType>[] = [
  {
    value: 'mkb',
    label: 'Подбор кода диагноза МКБ-10',
  },
  {
    value: 'autocomplete',
    label: 'Автодополнение текста',
  },
  {
    value: 'fullness',
    label: 'Проверка полноты полей',
  },
];

export default function MultipleDropdownExample() {
  const [selectedHelpers, setSelectedHelpers] = useState<HelperType[]>([]);

  return (
    <div className="p-8 space-y-6 max-w-md">
      <CustomDropdown<HelperType, true>
        multiple={true}
        options={HELPER_OPTIONS}
        value={selectedHelpers}
        onChange={setSelectedHelpers}
        placeholder="Выберите помощников..."
        renderTrigger={(rawOptions) => {
          const options = Array.isArray(rawOptions) ? rawOptions : [rawOptions];

          if (options.length === 0) {
            return (
              <span className="text-[#6C757D]">Выберите помощников...</span>
            );
          }

          return (
            <span className="text-sm text-[#202020] whitespace-normal break-words">
              {options.map((opt) => opt.label).join(', ')}
            </span>
          );
        }}
        showCheckIcon={true}
        renderOption={(option) => (
          <div className="flex items-center gap-3 w-full">
            <span className="text-sm text-[#202020] flex-1">
              {option.label}
            </span>
          </div>
        )}
      />
    </div>
  );
}
