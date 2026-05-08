'use client';

import {
  mainApi,
  ListConsultationsResponse,
  ListsTemplatesResponse,
  ProtocolStructuresFields,
  Protocols,
  ClinrecCheck,
  ClinicalFinding,
} from '@/api';
import { SectionInput } from '@/components/SectionInput';
import { Sidebar } from '@/components/Sidebar';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { TemplatePopup } from '@/components/template/TemplatePopup';
import { CreateTemplatePopup } from '@/components/template/CreateTemplatePopup';
import { useProtocolStructuresStore } from '@/store/protocolStructuresStore';
import { ProtocolsPost, StructureProtocolsFields } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useHelpersStore } from '@/store/helpersStore';

interface SectionData {
  id: number;
  label: string;
  value: string;
  sectionKey: string;
  fieldMeta?: StructureProtocolsFields;
}
export interface TemplateUI extends ListsTemplatesResponse {
  name: string;
  type: 'personal' | 'general';
  content?: Record<string, string>;
  groupId?: string;
}

const LOADING_MESSAGES = [
  'Принял задачу. Приступаю...',
  'Открываю базу. Ого, сколько тут...',
  'Читаю. Медленно, зато внимательно...',
  'Дочитал раздел. Интересно написано...',
  'Листаю приложения. Их много...',
  'Сравниваю с вашим протоколом...',
  'Смотрю на назначения очень внимательно...',
  'Сверяю с актуальной версией протокола...',
  'Нашёл кое-что важное для вас...',
  'Проверяю себя. На всякий случай...',
  'Собираю ответ. Ещё чуть-чуть...',
  'Готовлю результат. Скоро всё...',
  'Осталось немного. Терпение...',
  'Финальная сверка. Почти готово',
];

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    structures,
    isLoading: structuresLoading,
    fetchStructures,
    fetchStructureById,
  } = useProtocolStructuresStore();
  const { user } = useAuthStore();
  const { fetchUserSettings } = useHelpersStore();
  const [templateTitle, setTemplateTitle] = useState<string>(
    'Протокол консультации терапевта №1',
  );
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetchStructures();
  }, [fetchStructures]);
  useEffect(() => {
    const userId = user?.id;
    if (userId) {
      fetchUserSettings(userId).catch(() => {});
    }
  }, [user?.id, fetchUserSettings]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [currentProtocolStructure, setCurrentProtocolStructure] = useState<
    string | null
  >(null);
  const [activeSection, setActiveSection] = useState<string>('complaints');
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [sectionStatus, setSectionStatus] = useState<
    Record<string, { color: string; analysis: string } | null>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [showSaveAsTemplatePopup, setShowSaveAsTemplatePopup] = useState(false);
  const [isFromPage, setIsFromPage] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showClinRecPanel, setShowClinRecPanel] = useState(false);
  const [isLoadingClinRec, setIsLoadingClinRec] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [clinRecResults, setClinRecResults] = useState<{
    critical: ClinicalFinding[];
    warning: ClinicalFinding[];
    info: ClinicalFinding[];
  } | null>(null);
  const [clinRecError, setClinRecError] = useState<string | null>(null);

  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const collectProtocolText = useCallback(() => {
    return sections
      .map((section) => `${section.label}: ${section.value}.`)
      .join(' ');
  }, [sections]);

  const handleApplyTemplate = (template: TemplateUI) => {
    if (template.content) {
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          value: template.content?.[section.sectionKey] || section.value,
        })),
      );
    }
  };
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showTemplateMenu &&
        templateMenuRef.current &&
        !templateMenuRef.current.contains(event.target as Node)
      ) {
        setShowTemplateMenu(false);
      }
      if (
        showCreateMenu &&
        createMenuRef.current &&
        !createMenuRef.current.contains(event.target as Node)
      ) {
        setShowCreateMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCreateMenu, showTemplateMenu]);
  const initializeSectionsFromStructure = useCallback(
    (structure: ProtocolStructuresFields) => {
      const newSections = structure.fields
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((field, index) => ({
          id: index + 1,
          label: field.field_label,
          value: field.default_value || '',
          sectionKey: field.field_name,
          fieldMeta: field,
        }));

      setSections(newSections);

      if (
        newSections.length > 0 &&
        !newSections.find((s) => s.sectionKey === activeSection)
      ) {
        setActiveSection(newSections[0].sectionKey);
      }
    },
    [activeSection],
  );

  const handleCreateWithStructure = async (structureId: string) => {
    try {
      setIsLoading(true);

      const structure = await fetchStructureById(structureId);

      const field_values: Record<string, string> = {};
      structure!.fields.forEach((field) => {
        field_values[field.id] = field.default_value || '';
      });

      const protocolData: ProtocolsPost = {
        protocol_structure_id: structureId,
        patient_id: null,
        doctor_id: null,
        protocol_name: `Протокол ${structure!.structure_name} №${Date.now().toString().slice(-6)}`,
        status_protocol: 'draft',
        field_values,
      };

      const response = await mainApi.protocols.postProtocols(protocolData);
      const newId = response.id;

      if (newId) {
        setProtocolId(newId);
        initializeSectionsFromStructure(structure!);

        const params = new URLSearchParams(window.location.search);
        params.set('id', newId);
        params.set('structure_id', structureId);
        router.replace(`?${params.toString()}`, { scroll: false });

        loadProtocolsList();

        toast.success('Протокол создан');
      }
    } catch (error) {
      console.error('Ошибка создания протокола:', error);
      toast.error('Не удалось создать протокол');
    } finally {
      setIsLoading(false);
    }
  };
  const handleClinRecCheck = async () => {
    const protocolText = collectProtocolText();

    if (!protocolText.trim()) {
      toast.error('Протокол пуст. Заполните хотя бы один раздел.');
      return;
    }

    setIsLoadingClinRec(true);
    setClinRecResults(null);
    setClinRecError(null);
    setShowClinRecPanel(true);
    setCurrentMessageIndex(0);

    messageIntervalRef.current = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 6000);

    try {
      const requestData: ClinrecCheck = {
        protocol_text: protocolText,
      };

      const response = await mainApi.ml_handlers.ml_clinrec_check(requestData);

      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }

      const findings: ClinicalFinding[] = response.findings || [];

      setClinRecResults({
        critical: findings.filter((f) => f.severity === 'critical'),
        warning: findings.filter((f) => f.severity === 'warning'),
        info: findings.filter((f) => f.severity === 'info'),
      });

      const totalFindings = findings.length;
      if (totalFindings === 0) {
        toast.success('Протокол соответствует клиническим рекомендациям!');
      } else {
        const criticalCount = findings.filter(
          (f) => f.severity === 'critical',
        ).length;
        if (criticalCount > 0) {
          toast.warning(`Найдено ${criticalCount} критических замечаний`);
        } else {
          toast.info(`Найдено ${totalFindings} замечаний`);
        }
      }
    } catch (error) {
      console.error('Ошибка проверки по клин. реком.:', error);
      setClinRecError('Не удалось выполнить проверку. Попробуйте позже.');
      toast.error('Ошибка при проверке протокола');
    } finally {
      setIsLoadingClinRec(false);
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    }
  };
  useEffect(() => {
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, []);
  const handleCloseClinRecPanel = () => {
    setShowClinRecPanel(false);
    setClinRecResults(null);
    setClinRecError(null);
    setCurrentMessageIndex(0);
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
    }
  };

  const loadProtocolsList = async () => {
    setIsLoadingList(true);
    try {
      const response = await mainApi.protocols.getProtocols();
      setConsultations(response || []);
    } catch (error) {
      console.error('Ошибка загрузки списка:', error);
      setLoadError('Не удалось загрузить список протоколов');
    } finally {
      setIsLoadingList(false);
    }
  };
  const getCurrentProtocolContent = () => {
    const content: Record<string, string> = {};
    sections.forEach((section) => {
      content[section.sectionKey] = section.value;
    });
    return content;
  };
  const [consultations, setConsultations] = useState<Protocols[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingProtocolRef = useRef(false);

  const loadProtocol = async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    isLoadingProtocolRef.current = true;

    try {
      const response = await mainApi.protocols.getProtocolsById(id);

      let structure: ProtocolStructuresFields | null = null;

      if (response.protocol_structure_id) {
        structure = await fetchStructureById(response.protocol_structure_id);
        if (structure) {
          initializeSectionsFromStructure(structure);
        }
      }
      const fieldValuesByFieldName: Record<string, string> = {};

      if (structure && response.field_values) {
        const uuidToFieldName = structure.fields.reduce(
          (acc, field) => {
            if (field.id) {
              acc[field.id] = field.field_name;
            }
            return acc;
          },
          {} as Record<string, string>,
        );

        Object.entries(response.field_values).forEach(([uuid, value]) => {
          const fieldName = uuidToFieldName[uuid];
          if (fieldName && typeof value === 'string') {
            fieldValuesByFieldName[fieldName] = value;
          }
        });
      } else if (response.field_values) {
        Object.entries(response.field_values).forEach(([key, value]) => {
          if (typeof value === 'string') {
            fieldValuesByFieldName[key] = value;
          }
        });
      }

      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          value: fieldValuesByFieldName[section.sectionKey] ?? section.value,
        })),
      );

      setTemplateTitle(response.protocol_name || `Протокол №${id.slice(-12)}`);
      setCurrentProtocolStructure(response.protocol_structure_id);

      console.log('Протокол загружен:', id);
    } catch (error) {
      console.error('Ошибка загрузки протокола:', error);
      setLoadError('Не удалось загрузить протокол');
    } finally {
      setIsLoading(false);
      isLoadingProtocolRef.current = false;
    }
  };

  useEffect(() => {
    loadProtocolsList();
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setProtocolId(id);
      loadProtocol(id);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!protocolId || isLoadingProtocolRef.current) return;

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
    if (!protocolId || isSaving || isLoadingProtocolRef.current) return;
    setIsSaving(true);

    try {
      const field_values: Record<string, string> = {};
      sections.forEach((section) => {
        field_values[section.fieldMeta!.id] = section.value;
      });

      const dataToUpdate = {
        patient_id: null,
        doctor_id: null,
        protocol_name: templateTitle,
        status_protocol: 'draft' as const,
        field_values,
      };

      await mainApi.protocols.updateProtocolsById(protocolId, dataToUpdate);
      setLastSavedData(JSON.stringify({ templateTitle, sections }));
      console.log('Авто-сохранение:', protocolId);
    } catch (error) {
      console.error('Ошибка авто-сохранения:', error);
      toast.error('Ошибка сохранения');
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
  const sectionContainerRef = useRef<HTMLDivElement>(null);
  const handleSectionClick = useCallback((sectionKey: string) => {
    const element = sectionRefs.current[sectionKey];
    const container = sectionContainerRef.current;
    if (element && container) {
      const offsetTop = element.offsetTop - 200;
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
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
  const handleTemplateEnter = () => {
    setShowTemplateMenu(!showTemplateMenu);
  };

  return (
    <>
      <div className="fixed ml-3 mr-5 left-0 top-20 custom-height w-85.75 flex flex-col bg-[#F3F4F8]">
        <div className="relative" ref={createMenuRef}>
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="shrink-0 w-full hover:text-[#769CEF] bg-white rounded-xl h-13 cursor-pointer text-[#5D8CF1] px-6 transition-colors"
          >
            Создать новый протокол
          </button>

          {showCreateMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-custom p-2 z-50 max-h-60 overflow-y-auto">
              {structuresLoading ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  <div className="animate-spin mx-auto mb-2 rounded-full h-4 w-4 border-b-2 border-[#5D8CF1]"></div>
                  Загрузка структур...
                </div>
              ) : structures.length > 0 ? (
                <>
                  {structures.map((structure) => (
                    <button
                      key={structure.id}
                      onClick={() => {
                        handleCreateWithStructure(structure.id);
                        setShowCreateMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0F5FF] text-sm transition-colors group"
                    >
                      <div className="font-medium text-gray-800">
                        {structure.structure_name}
                      </div>
                      {structure.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {structure.description}
                        </div>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <div className="py-4 text-center text-sm text-gray-500">
                  Нет доступных структур
                </div>
              )}
            </div>
          )}
        </div>

        {isLoadingList ? (
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
        ) : (
          <div className="flex-1 mt-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {consultations.length > 0 ? (
              <div className="flex flex-col gap-1.25">
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
        )}
      </div>

      {isLoading && (
        <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-372.75 py-6.25 flex flex-row gap-16">
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
        </div>
      )}

      {protocolId && !isLoading && (
        <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-374.75 flex flex-col mr-2 h-[calc(100vh-55px)] custom-scrollbar overflow-hidden">
          <div className="mx-6.25 mt-2 bg-white border-b border-b-[#E9ECEF]">
            <div className="mx-auto mb-2 flex flex-row items-center justify-center gap-6">
              {!showClinRecPanel &&
                sections.find((s) => s.sectionKey === 'main_diagnosis')
                  ?.value && (
                  <button
                    onClick={handleClinRecCheck}
                    className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75"
                  >
                    <Image
                      alt="klinReg"
                      src="/check-all.svg"
                      width={20}
                      height={20}
                    />
                    Проверить по клин. реком.
                  </button>
                )}
              <button className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75">
                <Image
                  alt="print"
                  src="/print-fill.svg"
                  width={20}
                  height={20}
                />
                Напечатать протокол
              </button>
              <div
                className="relative"
                ref={templateMenuRef}
                onClick={handleTemplateEnter}
              >
                <button className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75">
                  <Image
                    alt="template"
                    src="/template-fill.svg"
                    width={20}
                    height={20}
                  />
                  Шаблоны
                </button>

                {showTemplateMenu && (
                  <div className="absolute left-0 top-full mt-2 w-46.25 bg-white rounded-xl shadow-custom p-1.5 z-50 flex flex-col">
                    <button
                      onClick={() => {
                        setShowTemplatePopup(true);
                        setShowTemplateMenu(false);
                      }}
                      className="hover:bg-[#F0F5FF] text-[14px] w-ful rounded-md h-8.25 cursor-pointer px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Использовать шаблон
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveAsTemplatePopup(true);
                        setIsFromPage(true);
                        setShowTemplateMenu(false);
                      }}
                      className="hover:bg-[#F0F5FF] text-[14px] cursor-pointer w-full  rounded-md h-8.25 px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Сохранить как шаблон
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="py-6.25 flex flex-row gap-16 pr-5 mr-2 overflow-hidden">
            <Sidebar
              sections={sidebarSections}
              activeSection={activeSection}
              onSectionClick={handleSectionClick}
              sectionStatus={sectionStatus}
            />

            <div
              className="flex flex-col gap-9 lg:ml-84.75 lg:w-full overflow-x-hidden overflow-y-auto pr-2"
              ref={sectionContainerRef}
            >
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
                      onAnalysisChange={(status) => {
                        setSectionStatus((prev) => ({
                          ...prev,
                          [section.sectionKey]: status,
                        }));
                      }}
                      isActive={section.sectionKey === activeSection}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowSaveAsTemplatePopup(true);
                    setIsFromPage(true);
                  }}
                  className="hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF]  rounded-xl h-13 ml-6 px-6 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Сохранить как шаблон
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="hover:bg-[#769CEF] mb-4 text-white rounded-xl h-13 ml-6 cursor-pointer bg-[#5D8CF1] px-6 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Сохранить'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClinRecPanel && (
        <div className="right-2 w-217.5 top-20 mr-2 h-[calc(100vh-90px)] bg-white rounded-[15px] flex flex-col overflow-hidden z-40">
          <div className="flex items-start justify-between px-6.25 pt-5 border-[#E9ECEF]">
            <h3 className="text-xl font-medium text-[#202020]">
              Проверка протокола по клиническим рекомендациям
            </h3>
            <button
              onClick={handleCloseClinRecPanel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Image alt="close" src="/close.svg" width={25} height={25} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoadingClinRec ? (
              <div className="text-center pt-9">
                <p className="text-[#909090] text-md transition-opacity duration-500 ease-in-out">
                  {LOADING_MESSAGES[currentMessageIndex]}
                </p>
              </div>
            ) : clinRecError ? (
              <div className="text-center pt-9">
                <p className="text-red-500 text-center">{clinRecError}</p>
              </div>
            ) : clinRecResults ? (
              <div className="py-7 px-6.25 space-y-5">
                {clinRecResults.critical.length > 0 && (
                  <div className="space-y-5">
                    {clinRecResults.critical.map((finding, index) => (
                      <div key={`critical-${index}`}>
                        <p className="text-xl font-medium text-[#D91528] pb-2">
                          {finding.section}
                        </p>
                        <p className="text-md leading-[140%]">
                          {finding.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {clinRecResults.warning.length > 0 && (
                  <div className="space-y-3">
                    {clinRecResults.warning.map((finding, index) => (
                      <div key={`warning-${index}`}>
                        <p className="text-xl font-medium text-[#F29100] pb-2">
                          {finding.section}
                        </p>
                        <p className="text-md leading-[140%]">
                          {finding.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {clinRecResults.info.length > 0 && (
                  <div className="space-y-3">
                    {clinRecResults.info.map((finding, index) => (
                      <div key={`info-${index}`}>
                        <p className="text-xl font-medium text-[#5D8CF1] pb-2">
                          {finding.section}
                        </p>
                        <p className="text-md leading-[140%]">
                          {finding.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {clinRecResults.critical.length === 0 &&
                  clinRecResults.warning.length === 0 &&
                  clinRecResults.info.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <p className="text-green-600 text-center font-medium">
                        Протокол соответствует клиническим рекомендациям
                      </p>
                    </div>
                  )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      <TemplatePopup
        isOpen={showTemplatePopup}
        onClose={() => setShowTemplatePopup(false)}
        onApply={handleApplyTemplate}
      />
      <CreateTemplatePopup
        isOpen={showSaveAsTemplatePopup}
        onClose={() => setShowSaveAsTemplatePopup(false)}
        isFromPage={isFromPage}
        onSuccess={() => setShowSaveAsTemplatePopup(false)}
        initialContent={getCurrentProtocolContent()}
        stayInEditor={true}
        currentStructure={currentProtocolStructure}
      />
    </>
  );
}
