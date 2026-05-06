'use client';

import { useState } from 'react';
import { RadioButton } from './RadioButton';

export default function Example() {
  const [selected, setSelected] = useState('active');
  const [customValue, setCustomValue] = useState('');

  return (
    <div className="space-y-4 p-8">
      <RadioButton
        id="active"
        name="status"
        value="active"
        checked={selected === 'active'}
        onChange={setSelected}
      >
        <span className="text-[#202020] text-md">Активная</span>
      </RadioButton>

      <RadioButton
        id="custom"
        name="status"
        value="custom"
        checked={selected === 'custom'}
        onChange={setSelected}
      >
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="Введите текст"
          className="text-[#202020] text-md placeholder-[#ADB5BD] border-none outline-none bg-transparent w-full"
        />
      </RadioButton>

      <RadioButton
        id="inactive"
        name="status"
        value="inactive"
        checked={selected === 'inactive'}
        onChange={setSelected}
      >
        <span className="text-[#202020] text-md">Активная 2</span>
      </RadioButton>
    </div>
  );
}
