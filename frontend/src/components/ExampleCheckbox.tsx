'use client';

import { useState } from 'react';
import { Checkbox } from './Checkbox';

interface Option {
  id: string;
  label: string;
  hasInput?: boolean;
}

const options: Option[] = [
  { id: 'activeCheck', label: 'Активная' },
  { id: 'customCheck', label: '', hasInput: true },
  { id: 'option1Check', label: 'Опция 1' },
  { id: 'option2Check', label: 'Опция 2' },
];

export default function Example() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  };

  const handleCustomInputChange = (id: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [id]: value }));

    // Авто-выбор чекбокса при вводе текста
    if (value && !selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
    if (!value && selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  return (
    <div className="space-y-4 p-8">
      {options.map((option) => (
        <Checkbox
          key={option.id}
          id={option.id}
          checked={selectedIds.includes(option.id)}
          onChange={(checked) => handleCheckboxChange(option.id, checked)}
        >
          {option.hasInput ? (
            <input
              type="text"
              value={customValues[option.id] || ''}
              onChange={(e) =>
                handleCustomInputChange(option.id, e.target.value)
              }
              placeholder="Введите текст"
              className="text-[#202020] text-md placeholder-[#ADB5BD] border-none outline-none bg-transparent w-full"
            />
          ) : (
            <span className="text-[#202020] text-md">{option.label}</span>
          )}
        </Checkbox>
      ))}
    </div>
  );
}
