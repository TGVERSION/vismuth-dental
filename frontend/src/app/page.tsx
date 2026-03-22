'use client';

import { SectionInput } from '@/components/SectionInput';
import { Sidebar } from '@/components/Sidebar';
import { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';

interface SectionData {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
}

export default function Home() {
  const [templateTitle, setTemplateTitle] = useState<string>(
    'Протокол консультации терапевта №1',
  );

  const [sections, setSections] = useState<SectionData[]>([
    { id: 1, label: 'Жалобы', value: '', sectionKey: 'complaints' },
    {
      id: 2,
      label: 'Анамнез заболевания',
      value: '',
      sectionKey: 'disease_anamnesis',
    },
    {
      id: 3,
      label: 'История заболевания',
      value: '',
      sectionKey: 'disease_history',
    },
    {
      id: 4,
      label: 'Анамнез жизни',
      value: '',
      sectionKey: 'life_anamnesis',
    },
    {
      id: 5,
      label: 'Вредные привычки и зависимости',
      value: '',
      sectionKey: 'bad_habits',
    },
    {
      id: 6,
      label: 'Аллергологический анамнез',
      value: '',
      sectionKey: 'allergy_anamnesis',
    },
    {
      id: 7,
      label: 'Витальные параметры',
      value: '',
      sectionKey: 'vital_parameters',
    },
    {
      id: 8,
      label: 'Объективные данные',
      value: '',
      sectionKey: 'objective_data',
    },
    {
      id: 9,
      label: 'Объективизированная оценка состояния',
      value: '',
      sectionKey: 'clinical_assessment',
    },
    {
      id: 10,
      label: 'Заключение консультации',
      value: '',
      sectionKey: 'consultation_conclusion',
    },
    {
      id: 11,
      label: 'Диагнозы',
      value: '',
      sectionKey: 'main_diagnosis',
    },
    {
      id: 12,
      label: 'Рекомендации',
      value: '',
      sectionKey: 'recommendations',
    },
    {
      id: 13,
      label: 'Назначения',
      value: '',
      sectionKey: 'prescriptions',
    },
  ]);
  const [activeSection, setActiveSection] = useState<string>('complaints');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleLabelChange = (id: number, newLabel: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, label: newLabel } : section,
      ),
    );
  };
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 300;
      let currentSection = activeSection;

      sections.forEach((section) => {
        const element = sectionRefs.current[section.sectionKey];
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetHeight = element.offsetHeight;

          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            currentSection = section.sectionKey;
          }
        }
      });

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections, activeSection]);

  const handleSectionClick = useCallback((sectionKey: string) => {
    const element = sectionRefs.current[sectionKey];
    if (element) {
      const offsetTop = element.offsetTop - 100;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      });
      setActiveSection(sectionKey);
    }
  }, []);

  const handleValueChange = (id: number, newValue: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, value: newValue } : section,
      ),
    );
    setActiveSection(sections.find((sec) => sec.id === id)?.label ?? '');
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

  const sidebarSections = sections.map((section) => ({
    id: section.sectionKey,
    label: section.label,
    hasContent: section.value.trim().length > 0,
  }));
  return (
    <>
      <div className="fixed ml-3 mr-5 left-0 top-20 h-[92vh] w-85.75 flex flex-col bg-[#F3F4F8] z-30">
        <button className="shrink-0 w-full mb-6 hover:text-[#769CEF] bg-white rounded-xl h-13 cursor-pointer text-[#5D8CF1] px-6 transition-colors">
          Создать новый протокол
        </button>
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="flex flex-col gap-1.25">
            <div className="px-3.75 py-2.25 text-[14px] font-semibold">
              2026
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">Март</div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2026</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2026</span>
            </div>
            <div className="px-3.75 py-2.25 text-[14px] font-semibold">
              2025
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">Март</div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2025</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2025</span>
            </div>
            <div className="px-3.75 py-2.25 text-[14px] font-semibold">
              2024
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">Март</div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2024</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2024</span>
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">
              Февраль
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 февр 2024</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 февр 2024</span>
            </div>
            <div className="px-3.75 py-2.25 text-[14px] font-semibold">
              2023
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">Март</div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2023</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 март 2023</span>
            </div>
            <div className="px-6.25 py-2.25 text-[14px] font-medium">
              Февраль
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 февр 2023</span>
            </div>
            <div className="ml-6.25 px-2.5 py-2.25 hover:bg-white rounded-[15px] transition-all cursor-pointer">
              <p className="text-[14px]">Протокол терапевта №6</p>
              <span className="text-[14px] text-[#6C757D]">1 февр 2023</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-372.75 py-6.25 flex flex-row gap-16">
        <Sidebar
          sections={sidebarSections}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
        />

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
              <div
                key={section.id}
                ref={(el) => {
                  sectionRefs.current[section.sectionKey] = el;
                }}
                className="scroll-mt-24"
              >
                <SectionInput
                  key={section.id}
                  id={section.id}
                  label={section.label}
                  value={section.value}
                  onLabelChange={handleLabelChange}
                  onValueChange={handleValueChange}
                  sectionKey={section.sectionKey}
                />
              </div>
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
