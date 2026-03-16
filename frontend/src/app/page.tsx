'use client';

import { SectionInput } from '@/components/SectionInput';
import { useState, ChangeEvent } from 'react';

interface SectionData {
  id: number;
  label: string;
  value: string;
}

export default function Home() {
  const [templateTitle, setTemplateTitle] = useState<string>(
    'Протокол консультации терапевта №1',
  );

  const [sections, setSections] = useState<SectionData[]>([
    { id: 1, label: 'Жалобы', value: '' },
    { id: 2, label: 'Анамнез заболевания', value: '' },
    { id: 3, label: 'История заболевания', value: '' },
    { id: 4, label: 'Анамнез жизни', value: '' },
    { id: 5, label: 'Вредные привычки и зависимости', value: '' },
    { id: 6, label: 'Аллергологический анамнез', value: '' },
    { id: 7, label: 'Витальные параметры', value: '' },
    { id: 8, label: 'Объективные данные', value: '' },
    { id: 9, label: 'Объективизированная оценка состояния', value: '' },
    { id: 10, label: 'Заключение консультации', value: '' },
    { id: 11, label: 'Диагнозы', value: '' },
    { id: 12, label: 'Рекомендации', value: '' },
    { id: 13, label: 'Назначения', value: '' },
  ]);

  const handleLabelChange = (id: number, newLabel: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, label: newLabel } : section,
      ),
    );
  };

  const handleValueChange = (id: number, newValue: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, value: newValue } : section,
      ),
    );
  };

  const handleSave = () => {
    const sectionsData: Record<string, string> = Object.fromEntries(
      sections.map((section) => [section.label, section.value]),
    );

    const dataToSave = {
      templateTitle,
      timestamp: new Date().toISOString(),
      ...sectionsData,
    };

    console.log('Сохраненные данные:', dataToSave);
  };

  return (
    <>
      <div className="mx-3 w-85.75">
        <button className="w-full hover:text-[#769CEF] bg-white rounded-xl h-13 cursor-pointer text-[#5D8CF1] px-6 transition-colors">
          Создать новый протокол
        </button>
      </div>
      <div className="bg-white rounded-[15px] w-full max-w-372.75 py-6.25 flex flex-row gap-16">
        <div className="fixed w-62.5 flex flex-col ml-5 gap-6">
          {sections.map((section) => (
            <p className="text-[15px]" key={section.id}>
              {section.label}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-12 ml-84.75 w-216 ">
          <input
            type="text"
            value={templateTitle}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setTemplateTitle(e.target.value)
            }
            className="text-[40px] pl-6 font-semibold leading-[150%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full"
          />

          <div className="flex gap-9 flex-col">
            {sections.map((section) => (
              <SectionInput
                key={section.id}
                id={section.id}
                label={section.label}
                value={section.value}
                onLabelChange={handleLabelChange}
                onValueChange={handleValueChange}
              />
            ))}
          </div>

          <button
            onClick={handleSave}
            className="hover:bg-[#769CEF] text-white rounded-xl h-13 ml-6 cursor-pointer bg-[#5D8CF1] px-6 transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}
