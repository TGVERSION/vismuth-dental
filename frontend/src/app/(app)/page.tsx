'use client';

import {
  ConsultationsRequest,
  mainApi,
  ListConsultationsResponse,
} from '@/api';
import { SectionInput } from '@/components/SectionInput';
import { Sidebar } from '@/components/Sidebar';
import { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

interface SectionData {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [templateTitle, setTemplateTitle] = useState<string>(
    'Протокол консультации терапевта №1',
  );

  const SECTION_TO_API_FIELD: Record<string, keyof ConsultationsRequest> = {
    complaints: 'complaints',
    disease_anamnesis: 'disease_anamnesis',
    disease_history: 'disease_history',
    life_anamnesis: 'life_anamnesis',
    bad_habits: 'bad_habits',
    allergy_anamnesis: 'allergy_anamnesis',
    vital_parameters: 'vital_parameters',
    objective_data: 'objective_data',
    clinical_assessment: 'clinical_assessment',
    consultation_conclusion: 'consultation_conclusion',
    main_diagnosis: 'main_diagnosis',
    recommendations: 'recommendations',
    prescriptions: 'prescriptions',
  };

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
    { id: 4, label: 'Анамнез жизни', value: '', sectionKey: 'life_anamnesis' },
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
    { id: 11, label: 'Диагнозы', value: '', sectionKey: 'main_diagnosis' },
    { id: 12, label: 'Рекомендации', value: '', sectionKey: 'recommendations' },
    { id: 13, label: 'Назначения', value: '', sectionKey: 'prescriptions' },
  ]);

  const [activeSection, setActiveSection] = useState<string>('complaints');
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 🔹 Список протоколов из API
  const [consultations, setConsultations] = useState<
    ListConsultationsResponse[]
  >([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadConsultationsList = async () => {
    setIsLoadingList(true);
    try {
      const response = await mainApi.consultations.getLists();
      setConsultations(response || []);
      console.log('Список протоколов загружен:', response?.length);
    } catch (error) {
      console.error('Ошибка загрузки списка:', error);
      setLoadError('Не удалось загрузить список протоколов');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadProtocol = async (id: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await mainApi.consultations.getConsultation(id);

      setSections((prev) =>
        prev.map((section) => {
          const apiField = SECTION_TO_API_FIELD[section.sectionKey];
          if (!apiField) return section;

          const apiValue = response[apiField];
          return {
            ...section,
            value: typeof apiValue === 'string' ? apiValue : '',
          };
        }),
      );

      // Обновляем заголовок если есть
      // if (response.template_title) {
      setTemplateTitle(`Протокол №${response.id.slice(-12)}`);
      // }

      console.log('Протокол загружен:', id);
    } catch (error) {
      console.error('Ошибка загрузки протокола:', error);
      setLoadError('Не удалось загрузить протокол');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConsultationsList();
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setProtocolId(id);
      loadProtocol(id);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!protocolId) return;

    const currentData = JSON.stringify({ templateTitle, sections });
    if (currentData === lastSavedData) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      await autoSave();
      setLastSavedData(currentData);
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [templateTitle, sections, protocolId, lastSavedData]);

  const autoSave = async () => {
    if (!protocolId || isSaving) return;
    setIsSaving(true);

    try {
      const dataToUpdate: ConsultationsRequest = {
        id: protocolId,
        external_system: 0,
        external_patient_id: 0,
        external_doctor_id: 0,
        external_visit_id: 0,
        consultation_datetime: new Date().toISOString(),
        complaints:
          sections.find((s) => s.sectionKey === 'complaints')?.value || '',
        disease_anamnesis:
          sections.find((s) => s.sectionKey === 'disease_anamnesis')?.value ||
          '',
        disease_history:
          sections.find((s) => s.sectionKey === 'disease_history')?.value || '',
        patient_condition: '',
        life_anamnesis:
          sections.find((s) => s.sectionKey === 'life_anamnesis')?.value || '',
        bad_habits:
          sections.find((s) => s.sectionKey === 'bad_habits')?.value || '',
        allergy_anamnesis:
          sections.find((s) => s.sectionKey === 'allergy_anamnesis')?.value ||
          '',
        vital_parameters:
          sections.find((s) => s.sectionKey === 'vital_parameters')?.value ||
          '',
        objective_data:
          sections.find((s) => s.sectionKey === 'objective_data')?.value || '',
        clinical_assessment:
          sections.find((s) => s.sectionKey === 'clinical_assessment')?.value ||
          '',
        consultation_conclusion:
          sections.find((s) => s.sectionKey === 'consultation_conclusion')
            ?.value || '',
        main_diagnosis:
          sections.find((s) => s.sectionKey === 'main_diagnosis')?.value || '',
        comorbid_diagnoses: '',
        recommendations:
          sections.find((s) => s.sectionKey === 'recommendations')?.value || '',
        prescriptions:
          sections.find((s) => s.sectionKey === 'prescriptions')?.value || '',
        status_protocol: 'draft',
      };

      await mainApi.consultations.update(protocolId, dataToUpdate);
      console.log('Авто-сохранение:', protocolId);
    } catch (error) {
      console.error('Ошибка авто-сохранения:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
      const offsetTop = element.offsetTop - 300;
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
    setActiveSection(sections.find((sec) => sec.id === id)?.sectionKey ?? '');
  };

  const handleSave = async () => {
    if (protocolId) {
      await autoSave();
      toast.success('Протокол сохранён');
    } else {
      await createNew();
    }
  };

  const handleConsultationClick = (id: string) => {
    setProtocolId(id);
    loadProtocol(id);

    const params = new URLSearchParams(window.location.search);
    params.set('id', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const sidebarSections = sections.map((section) => ({
    id: section.sectionKey,
    label: section.label,
    hasContent: section.value.trim().length > 0,
  }));

  const createNew = async () => {
    try {
      const localDate = new Date();
      const consultation_datetime = new Date(
        localDate.getTime() - localDate.getTimezoneOffset() * 60000,
      ).toISOString();

      const dataToSend: ConsultationsRequest = {
        id: '',
        external_system: 0,
        external_patient_id: 0,
        external_doctor_id: 0,
        external_visit_id: 0,
        consultation_datetime,
        complaints: '',
        disease_anamnesis: '',
        disease_history: '',
        patient_condition: '',
        life_anamnesis: '',
        bad_habits: '',
        allergy_anamnesis: '',
        vital_parameters: '',
        objective_data: '',
        clinical_assessment: '',
        consultation_conclusion: '',
        main_diagnosis: '',
        comorbid_diagnoses: '',
        recommendations: '',
        prescriptions: '',
        status_protocol: 'draft',
      };

      const response = await mainApi.consultations.create(dataToSend);

      const newId = response.id?.toString() || response.id;
      if (newId) {
        setProtocolId(newId);

        const params = new URLSearchParams(window.location.search);
        params.set('id', newId);
        router.replace(`?${params.toString()}`, { scroll: false });

        console.log('Протокол создан, ID:', newId);

        loadConsultationsList();
      }
    } catch (error) {
      console.error('Ошибка создания протокола:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };
  return (
    <>
      {/* Левая панель со списком протоколов */}
      <div className="fixed ml-3 mr-5 left-0 top-20 custom-height w-85.75 flex flex-col bg-[#F3F4F8] z-30">
        <button
          onClick={createNew}
          className="shrink-0 w-full mb-6 hover:text-[#769CEF] bg-white rounded-xl h-13 cursor-pointer text-[#5D8CF1] px-6 transition-colors"
        >
          Создать новый протокол
        </button>

        {/* Индикатор загрузки списка */}
        {isLoadingList && (
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {consultations.length > 0 ? (
            <div className="flex flex-col gap-1.25">
              {/* Группировка по годам */}
              {Object.entries(
                consultations.reduce(
                  (acc, consultation) => {
                    const year = new Date(
                      consultation.updated_at,
                    ).getFullYear();
                    if (!acc[year]) acc[year] = [];
                    acc[year].push(consultation);
                    return acc;
                  },
                  {} as Record<string, ListConsultationsResponse[]>,
                ),
              ).map(([year, yearConsultations]) => (
                <div key={year} className="flex flex-col gap-1.25">
                  <div className="px-3.75 py-2.25 text-[14px] font-semibold">
                    {year}
                  </div>

                  {/* Группировка по месяцам */}
                  {Object.entries(
                    yearConsultations.reduce(
                      (acc, consultation) => {
                        const month = new Date(
                          consultation.updated_at,
                        ).toLocaleDateString('ru-RU', { month: 'long' });
                        if (!acc[month]) acc[month] = [];
                        acc[month].push(consultation);
                        return acc;
                      },
                      {} as Record<string, ListConsultationsResponse[]>,
                    ),
                  ).map(([month, monthConsultations]) => (
                    <div key={month} className="flex flex-col gap-1.25">
                      <div className="px-6.25 py-2.25 text-[14px] font-medium">
                        {month.charAt(0).toUpperCase() + month.slice(1)}
                      </div>

                      {monthConsultations.map((consultation) => (
                        <div
                          key={consultation.id}
                          onClick={() =>
                            handleConsultationClick(consultation.id)
                          }
                          className={`ml-6.25 px-2.5 py-2.25 rounded-[15px] transition-all cursor-pointer ${
                            protocolId === consultation.id
                              ? 'bg-white'
                              : 'hover:bg-white'
                          }`}
                        >
                          <p className="text-[14px] font-medium">
                            {consultation.protocol_name ||
                              `Протокол №${consultation.id.slice(-12)}`}
                          </p>
                          <span className="text-[14px] text-[#6C757D]">
                            {formatDate(consultation.updated_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            !isLoadingList && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                Нет сохранённых протоколов
              </div>
            )
          )}
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-372.75 py-6.25 flex flex-row gap-16">
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
        </div>
      )}

      {/* Основной контент */}
      {protocolId && !isLoading && (
        <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-372.75 py-6.25 flex flex-row gap-16 pr-5 mr-2">
          <Sidebar
            sections={sidebarSections}
            activeSection={activeSection}
            onSectionClick={handleSectionClick}
          />

          <div className="flex flex-col gap-12 lg:ml-84.75 max-w-216">
            <div className="text-[40px] pl-6 font-semibold leading-[150%] bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
              {templateTitle}
            </div>

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
              disabled={isSaving}
              className="hover:bg-[#769CEF] text-white rounded-xl h-13 ml-6 cursor-pointer bg-[#5D8CF1] px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Сохранить'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
