'use client';

import {
  mainApi,
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
import { ProtocolsPost } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useHelpersStore } from '@/store/helpersStore';
import { logError } from '@/lib/logger';
import { isAbortError } from '@/api/base-client';
import {
  DEFAULT_ACTIVE_SECTION,
  findMainDiagnosisValue,
} from '@/lib/protocol-fields';
import {
  buildSectionsFromStructure,
  type DraftSection,
} from '@/lib/protocol-draft';
import { useProtocolDraft } from '@/hooks/useProtocolDraft';
import { useVisitRecorder } from '@/hooks/useVisitRecorder';
import { useTranscriptionResult } from '@/hooks/useTranscriptionResult';
import { VisitRecorderButton } from '@/components/voice/VisitRecorderButton';
import { VoiceFillBanner } from '@/components/voice/VoiceFillBanner';
import { TranscriptPanel } from '@/components/voice/TranscriptPanel';
import { useProtocolTranscripts } from '@/hooks/useProtocolTranscripts';
import {
  applyVoiceFill,
  revertAllVoiceFill,
  revertVoiceFill,
  type VoiceFillEntry,
} from '@/lib/voice-fill';
import { hasEnoughSessionTime } from '@/lib/jwt';
import { RECORDING_TOKEN_MARGIN_MS } from '@/lib/voice-recording';

type SectionData = DraftSection;
export interface TemplateUI extends ListsTemplatesResponse {
  name: string;
  type: 'personal' | 'general';
  content?: Record<string, string>;
  groupId?: string;
}

const SIDEBAR_HIDE_THRESHOLD = 800;

/**
 * Отступ колонки протокола, когда показано оглавление разделов.
 *
 * Оглавление — `fixed` шириной 250px с собственным отступом 25px, то есть
 * занимает первые 275px. Отступ колонки задаётся здесь целиком, без `gap`
 * у родителя: обёртка оглавления в потоке нулевой ширины, и разносить сдвиг
 * по двум свойствам значило бы считать зазор в двух местах сразу.
 *
 * 300px = 275px оглавления + 25px зазора. Прежние 339px плюс `gap-16`
 * складывались в 403px и оставляли около 128px пустоты, зря сужая текст.
 */
const PROTOCOL_COLUMN_WITH_SIDEBAR = 'lg:ml-75 lg:w-full';
const MIN_CLINREC_WIDTH = 300;
const MAX_CLINREC_WIDTH = 900;
const DEFAULT_CLINREC_WIDTH = 550;

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
  const { fetchUserSettings, voiceEnabled } = useHelpersStore();
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
  const [activeSection, setActiveSection] = useState<string>(
    DEFAULT_ACTIVE_SECTION,
  );
  const [protocolId, setProtocolId] = useState<string | null>(null);
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

  const [showClinRecPanel, setShowClinRecPanel] = useState(false);
  // Панель расшифровки делит правую колонку с клинреками: открыта всегда
  // только одна из них, ширина и разделитель общие.
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<
    string | null
  >(null);
  const [isLoadingClinRec, setIsLoadingClinRec] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [clinRecResults, setClinRecResults] = useState<{
    critical: ClinicalFinding[];
    warning: ClinicalFinding[];
    info: ClinicalFinding[];
  } | null>(null);
  const [clinRecError, setClinRecError] = useState<string | null>(null);

  const [clinRecPanelWidth, setClinRecPanelWidth] = useState(
    DEFAULT_CLINREC_WIDTH,
  );
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const isDraggingDividerRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const [protocolAreaEl, setProtocolAreaEl] = useState<HTMLDivElement | null>(
    null,
  );

  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clinRecAbortRef = useRef<AbortController | null>(null);

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
  const applySections = useCallback((newSections: SectionData[]) => {
    setSections(newSections);
    setActiveSection((prev) =>
      newSections.some((s) => s.sectionKey === prev)
        ? prev
        : (newSections[0]?.sectionKey ?? ''),
    );
  }, []);

  const handleCreateWithStructure = async (structureId: string) => {
    try {
      await flushPendingSave();
      setIsLoading(true);

      const structure = await fetchStructureById(structureId);

      const field_values: Record<string, string> = {};
      structure!.fields.forEach((field) => {
        field_values[field.id] = field.default_value || '';
      });

      const newTitle = `Протокол ${structure!.structure_name} №${Date.now().toString().slice(-6)}`;

      const protocolData: ProtocolsPost = {
        protocol_structure_id: structureId,
        patient_id: null,
        doctor_id: null,
        protocol_name: newTitle,
        status_protocol: 'draft',
        field_values,
      };

      const response = await mainApi.protocols.postProtocols(protocolData);
      const newId = response.id;

      if (newId) {
        const newSections = buildSectionsFromStructure(structure!);

        setProtocolId(newId);
        applySections(newSections);
        setTemplateTitle(newTitle);
        setCurrentProtocolStructure(structureId);

        // Протокол только что создан именно с этими значениями —
        // помечаем их сохранёнными, чтобы автосохранение не сработало вхолостую.
        loadedProtocolIdRef.current = newId;
        resetBaseline(newTitle, newSections);

        const params = new URLSearchParams(window.location.search);
        params.set('id', newId);
        params.set('structure_id', structureId);
        router.replace(`?${params.toString()}`, { scroll: false });

        loadProtocolsList();

        toast.success('Протокол создан');
      }
    } catch (error) {
      logError('Ошибка создания протокола:', error);
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

    clinRecAbortRef.current?.abort();
    const controller = new AbortController();
    clinRecAbortRef.current = controller;

    setIsLoadingClinRec(true);
    setClinRecResults(null);
    setClinRecError(null);
    setShowTranscriptPanel(false);
    setShowClinRecPanel(true);
    setCurrentMessageIndex(0);

    messageIntervalRef.current = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 6000);

    try {
      const requestData: ClinrecCheck = {
        protocol_text: protocolText,
      };

      const response = await mainApi.ml_handlers.ml_clinrec_check(requestData, {
        signal: controller.signal,
      });

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
      // Отмена — не ошибка: врач закрыл панель, пока запрос был в пути.
      if (isAbortError(error)) return;
      logError('Ошибка проверки по клин. реком.:', error);
      setClinRecError('Не удалось выполнить проверку. Попробуйте позже.');
      toast.error('Ошибка при проверке протокола');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingClinRec(false);
      }
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
      clinRecAbortRef.current?.abort();
    };
  }, []);
  const handleCloseClinRecPanel = () => {
    // Закрытие панели прекращает и сам запрос: иначе врач ждал бы ответ,
    // который уже некуда показывать.
    clinRecAbortRef.current?.abort();
    clinRecAbortRef.current = null;
    setIsLoadingClinRec(false);
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
      logError('Ошибка загрузки списка:', error);
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
  // Контейнер прокрутки разделов держим состоянием, а не ref: эффект подсветки
  // должен пересобираться, когда элемент появляется в DOM.
  const [sectionContainerEl, setSectionContainerEl] =
    useState<HTMLDivElement | null>(null);
  const suppressScrollSpyUntilRef = useRef(0);
  const isLoadingProtocolRef = useRef(false);
  // Актуальные разделы для loadProtocol: если у протокола нет структуры,
  // значения раскладываются по уже показанным разделам.
  const sectionsRef = useRef<SectionData[]>([]);
  // Какой протокол уже загружен в форму. Эффект по ?id пропускает загрузку,
  // если данные этого протокола только что получены другим путём (создание).
  const loadedProtocolIdRef = useRef<string | null>(null);

  // Автосохранение черновика вынесено в отдельный хук: там цикл сохранения,
  // отложенные правки, автоповтор после сбоя и предупреждение при закрытии.
  const {
    isSaving,
    saveFailed,
    hasUnsavedChanges,
    saveNow,
    flushPendingSave,
    resetBaseline,
    cancelPending,
  } = useProtocolDraft({
    protocolId,
    title: templateTitle,
    sections,
    isLoading,
  });

  // Запись приёма: расшифровка раскладывается по полям сервером, а здесь
  // применяется к форме. Записи о применённом живут только в памяти экрана —
  // это материал для подсветки и отката.
  const [voiceEntries, setVoiceEntries] = useState<VoiceFillEntry[]>([]);
  // Из какой записи заполнен протокол: баннер открывает панель именно на ней.
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);

  // Список записей нужен только при включённом помощнике: `null` не даёт
  // уйти ни одному запросу.
  const transcripts = useProtocolTranscripts(voiceEnabled ? protocolId : null);
  const reloadTranscripts = transcripts.reload;
  const isTranscriptPanelOpen = showTranscriptPanel && voiceEnabled;

  const handleTranscriptionReady = useCallback(
    (result: {
      session_id: string;
      field_values: Record<string, string> | null;
    }) => {
      // Новая запись появилась в списке — панель должна её увидеть и
      // показывать по умолчанию, даже если приём не дал текста для полей.
      reloadTranscripts();
      setSelectedTranscriptId(result.session_id);
      if (!result.field_values) {
        toast.info('В записи не нашлось текста для полей протокола.', {
          toastId: 'voice-no-fields',
        });
        return;
      }

      setSections((prev) => {
        const { sections: next, entries } = applyVoiceFill(
          prev,
          result.field_values ?? {},
        );
        setVoiceEntries(entries);
        if (entries.length === 0) {
          // Updater может вызываться дважды (StrictMode) — toastId гасит дубль.
          toast.info('В записи не нашлось текста для полей протокола.', {
            toastId: 'voice-no-fields',
          });
        }
        return next;
      });
      setVoiceSessionId(result.session_id);
    },
    [reloadTranscripts],
  );

  const {
    isProcessing: isTranscribing,
    isConnectionLost: isTranscriptionConnectionLost,
    watch: watchTranscription,
  } = useTranscriptionResult({
    // Помощник выключен — записи нет ни в интерфейсе, ни в запросах: `null`
    // останавливает и опрос статуса, и поиск сессии протокола.
    protocolId: voiceEnabled ? protocolId : null,
    onReady: handleTranscriptionReady,
    // Упавшая запись должна сразу появиться в панели с пометкой.
    onFailed: reloadTranscripts,
  });

  const recorder = useVisitRecorder({
    protocolId: voiceEnabled ? protocolId : null,
    onCompleted: watchTranscription,
  });

  const accessToken = useAuthStore((state) => state.accessToken);
  // Раскладывать результат некуда, если у разделов нет полей структуры.
  const hasStructureFields = sections.some((section) => section.fieldMeta?.id);

  const recorderDisabledReason = !protocolId
    ? 'Сначала откройте или создайте протокол'
    : !hasStructureFields
      ? 'У протокола нет структуры: результат записи некуда разложить'
      : null;

  const handleStartRecording = () => {
    // Токен живёт 60 минут и не продлевается: если он истечёт посреди приёма,
    // 401 сбросит авторизацию и запись оборвётся.
    if (!hasEnoughSessionTime(accessToken, RECORDING_TOKEN_MARGIN_MS)) {
      toast.warning(
        'Сессия скоро истечёт. Лучше выйти и войти заново, иначе запись может прерваться посреди приёма.',
        { toastId: 'voice-session-expiring' },
      );
    }
    void recorder.start();
  };

  const handleStopRecording = () => {
    void recorder.stop().catch(() => {
      // Сообщение уже показано хуком через своё состояние ошибки.
    });
  };

  const handleRevertVoiceField = (entry: VoiceFillEntry) => {
    setSections((prev) => revertVoiceFill(prev, entry));
    setVoiceEntries((prev) =>
      prev.filter((item) => item.sectionId !== entry.sectionId),
    );
  };

  const handleRevertAllVoice = () => {
    setSections((prev) => revertAllVoiceFill(prev, voiceEntries));
    setVoiceEntries([]);
    setVoiceSessionId(null);
  };

  const handleOpenTranscriptPanel = (sessionId?: string | null) => {
    // Правая колонка одна: открытие расшифровки закрывает клинреки и
    // прекращает их запрос.
    handleCloseClinRecPanel();
    if (sessionId) setSelectedTranscriptId(sessionId);
    reloadTranscripts();
    setShowTranscriptPanel(true);
  };

  const loadProtocol = async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    isLoadingProtocolRef.current = true;

    // Открывается другой протокол — отложенное сохранение предыдущего
    // не должно уехать под новым id.
    cancelPending();
    // Подсветка и снимки для отката относятся к прежнему протоколу.
    setVoiceEntries([]);
    setVoiceSessionId(null);
    // Расшифровки чужого протокола показывать нельзя.
    setShowTranscriptPanel(false);
    setSelectedTranscriptId(null);

    try {
      const response = await mainApi.protocols.getProtocolsById(id);

      let structure: ProtocolStructuresFields | null = null;
      let nextSections: SectionData[] = sectionsRef.current;

      if (response.protocol_structure_id) {
        structure = await fetchStructureById(response.protocol_structure_id);
        if (structure) {
          nextSections = buildSectionsFromStructure(structure);
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

      nextSections = nextSections.map((section) => ({
        ...section,
        value: fieldValuesByFieldName[section.sectionKey] ?? section.value,
      }));

      const nextTitle = response.protocol_name || `Протокол №${id.slice(-12)}`;

      applySections(nextSections);
      setTemplateTitle(nextTitle);
      setCurrentProtocolStructure(response.protocol_structure_id);

      // Загруженное состояние и есть сохранённое: без этого автосохранение
      // немедленно отправляло бы обратно только что прочитанные данные.
      loadedProtocolIdRef.current = id;
      resetBaseline(nextTitle, nextSections);
    } catch (error) {
      logError('Ошибка загрузки протокола:', error);
      setLoadError('Не удалось загрузить протокол');
    } finally {
      setIsLoading(false);
      isLoadingProtocolRef.current = false;
    }
  };

  useEffect(() => {
    loadProtocolsList();
  }, []);

  // Единственное место, где протокол загружается. Обработчики только меняют
  // ?id в URL — иначе клик по протоколу давал два параллельных GET к одному
  // ресурсу и гонку их ответов.
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    setProtocolId(id);

    if (loadedProtocolIdRef.current === id) return;
    loadProtocol(id);
    // loadProtocol пересоздаётся на каждый рендер и в зависимостях вызвал бы
    // бесконечную перезагрузку; защита от повторной загрузки — в ref выше.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const handleLabelChange = (id: number, newLabel: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, label: newLabel } : section,
      ),
    );
  };

  // Прокручивается внутренний контейнер разделов, а не окно: прокрутка body
  // отключена в layout, поэтому window.scrollY всегда 0 и прежний обработчик
  // никогда не срабатывал. Позицию считаем через getBoundingClientRect, чтобы
  // не зависеть от того, какой предок оказался offsetParent.
  useEffect(() => {
    if (!sectionContainerEl) return;

    const ACTIVE_LINE_OFFSET = 200;

    const handleScroll = () => {
      if (Date.now() < suppressScrollSpyUntilRef.current) return;

      const containerTop = sectionContainerEl.getBoundingClientRect().top;
      let currentSection = activeSection;

      sections.forEach((section) => {
        const element = sectionRefs.current[section.sectionKey];
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const top = rect.top - containerTop;

        if (
          top <= ACTIVE_LINE_OFFSET &&
          top + rect.height > ACTIVE_LINE_OFFSET
        ) {
          currentSection = section.sectionKey;
        }
      });

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    sectionContainerEl.addEventListener('scroll', handleScroll, {
      passive: true,
    });
    return () => sectionContainerEl.removeEventListener('scroll', handleScroll);
  }, [sections, activeSection, sectionContainerEl]);
  const handleSectionClick = useCallback(
    (sectionKey: string) => {
      const element = sectionRefs.current[sectionKey];
      if (element && sectionContainerEl) {
        const offsetTop = element.offsetTop - 200;
        // Плавная прокрутка порождает поток событий scroll; без паузы
        // скролл-шпион тут же перебил бы явный выбор врача — особенно
        // в коротком протоколе, где нужный раздел не доходит до верха.
        suppressScrollSpyUntilRef.current = Date.now() + 800;
        sectionContainerEl.scrollTo({ top: offsetTop, behavior: 'smooth' });
        setActiveSection(sectionKey);
      }
    },
    [sectionContainerEl],
  );

  const handleValueChange = (id: number, newValue: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, value: newValue } : section,
      ),
    );
    setActiveSection(sections.find((sec) => sec.id === id)?.sectionKey ?? '');
    // Врач правит поле — подсветка «из записи» снимается, и откат его больше
    // не касается: иначе возврат прежнего значения затёр бы свежую правку.
    setVoiceEntries((prev) =>
      prev.some((entry) => entry.sectionId === id)
        ? prev.filter((entry) => entry.sectionId !== id)
        : prev,
    );
  };

  const handleSave = async () => {
    if (!protocolId) return;

    const ok = await saveNow();
    if (ok) toast.success('Протокол сохранён');
  };

  const handleConsultationClick = async (id: string) => {
    if (id === protocolId) return;

    await flushPendingSave();

    const params = new URLSearchParams(window.location.search);
    params.set('id', id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const sidebarSections = sections.map((section) => ({
    id: section.sectionKey,
    label: section.label,
    hasContent: section.value.trim().length > 0,
  }));

  // Протокол, созданный из анкеты, до первого сохранения приходит без
  // `updated_at` — тогда в списке показываем дату создания.
  const protocolDate = (protocol: Protocols) =>
    protocol.updated_at ?? protocol.created_at;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };
  // Печать протокола. Печатается только сам протокол: боковые панели и
  // тулбар скрыты правилами @media print в globals.css.
  const handlePrint = async () => {
    await flushPendingSave();
    window.print();
  };

  const handleTemplateEnter = () => {
    setShowTemplateMenu(!showTemplateMenu);
  };

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingDividerRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = clinRecPanelWidth;
      setIsDraggingDivider(true);
    },
    [clinRecPanelWidth],
  );

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDividerRef.current) return;
      const delta = dragStartXRef.current - e.clientX;
      const newWidth = Math.max(
        MIN_CLINREC_WIDTH,
        Math.min(MAX_CLINREC_WIDTH, dragStartWidthRef.current + delta),
      );
      setClinRecPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingDividerRef.current = false;
      setIsDraggingDivider(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    if (!protocolAreaEl) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsSidebarVisible(entry.contentRect.width > SIDEBAR_HIDE_THRESHOLD);
      }
    });
    observer.observe(protocolAreaEl);
    return () => observer.disconnect();
  }, [protocolAreaEl]);

  return (
    <>
      <div
        data-print-hide
        className="fixed ml-3 mr-5 left-0 top-20 custom-height w-85.75 flex flex-col bg-[#F3F4F8]"
      >
        <div className="relative" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (!showCreateMenu) fetchStructures();
              setShowCreateMenu(!showCreateMenu);
            }}
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
                      type="button"
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
                        protocolDate(consultation),
                      ).getFullYear();
                      if (!acc[year]) acc[year] = [];
                      acc[year].push(consultation);
                      return acc;
                    },
                    {} as Record<string, Protocols[]>,
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
                            protocolDate(consultation),
                          ).toLocaleDateString('ru-RU', { month: 'long' });
                          if (!acc[month]) acc[month] = [];
                          acc[month].push(consultation);
                          return acc;
                        },
                        {} as Record<string, Protocols[]>,
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
                              {formatDate(protocolDate(consultation))}
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

      {loadError && !isLoading && (
        <div className="bg-white rounded-[15px] ml-93.5 w-full max-w-372.75 py-6.25">
          <p className="my-40 text-center text-[#D91528]">{loadError}</p>
        </div>
      )}

      {protocolId && !isLoading && (
        <>
          <div
            ref={setProtocolAreaEl}
            data-print-area
            className={`bg-white rounded-[15px] ml-93.5 flex-1 min-w-0 flex flex-col h-[calc(100vh-55px)] custom-scrollbar overflow-hidden ${showClinRecPanel || isTranscriptPanelOpen ? '' : 'mr-2'}`}
          >
            <div
              data-print-hide
              className="mx-6.25 mt-2 bg-white border-b border-b-[#E9ECEF]"
            >
              <div className="mx-auto mb-2 flex flex-row items-center justify-center gap-6">
                {!showClinRecPanel && findMainDiagnosisValue(sections) && (
                  <button
                    type="button"
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
                {voiceEnabled && (
                  <VisitRecorderButton
                    state={recorder.state}
                    durationMs={recorder.durationMs}
                    pendingChunks={recorder.pendingChunks}
                    disabledReason={recorderDisabledReason}
                    isProcessing={isTranscribing}
                    isConnectionLost={isTranscriptionConnectionLost}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                    onPause={recorder.pause}
                    onResume={recorder.resume}
                    onCancel={() => void recorder.cancel()}
                  />
                )}
                {voiceEnabled &&
                  !isTranscriptPanelOpen &&
                  transcripts.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenTranscriptPanel()}
                      className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75"
                    >
                      <Image
                        alt=""
                        src="/transcript.svg"
                        width={20}
                        height={20}
                      />
                      Расшифровка приёма
                    </button>
                  )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75"
                >
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
                  <button
                    type="button"
                    className="cursor-pointer rounded-xl hover:bg-white shadow-custom-hover flex flex-row items-center gap-2 py-3 px-3.75"
                  >
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
                        type="button"
                        onClick={() => {
                          setShowTemplatePopup(true);
                          setShowTemplateMenu(false);
                        }}
                        className="hover:bg-[#F0F5FF] text-[14px] w-ful rounded-md h-8.25 cursor-pointer px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        Использовать шаблон
                      </button>
                      <button
                        type="button"
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

            <div className="py-6.25 flex flex-row pr-5 mr-2 overflow-hidden">
              {isSidebarVisible && (
                <div data-print-hide>
                  <Sidebar
                    sections={sidebarSections}
                    activeSection={activeSection}
                    onSectionClick={handleSectionClick}
                    sectionStatus={sectionStatus}
                  />
                </div>
              )}

              <div
                className={`flex flex-col gap-9 overflow-x-hidden overflow-y-auto pr-2 ${isSidebarVisible ? PROTOCOL_COLUMN_WITH_SIDEBAR : 'w-full'}`}
                ref={setSectionContainerEl}
              >
                <div className="text-[40px] pl-6 font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 w-full">
                  {templateTitle}
                </div>

                <VoiceFillBanner
                  entries={voiceEntries}
                  onShowTranscript={() =>
                    handleOpenTranscriptPanel(voiceSessionId)
                  }
                  onRevertAll={handleRevertAllVoice}
                  onDismiss={() => {
                    setVoiceEntries([]);
                    setVoiceSessionId(null);
                  }}
                />

                <div className="flex gap-9 flex-col pl-6">
                  {sections.map((section) => {
                    const voiceEntry = voiceEntries.find(
                      (entry) => entry.sectionId === section.id,
                    );

                    return (
                      <div
                        key={section.id}
                        ref={(el) => {
                          sectionRefs.current[section.sectionKey] = el;
                        }}
                        className={
                          voiceEntry
                            ? 'scroll-mt-24 rounded-xl border-l-4 border-[#5D8CF1] bg-[#F8FAFF] pl-2 py-1'
                            : 'scroll-mt-24'
                        }
                      >
                        {voiceEntry && (
                          <div
                            data-print-hide
                            className="ml-7 mb-1 flex items-center gap-3 text-[13px] text-[#5D8CF1]"
                          >
                            <span>
                              {voiceEntry.mode === 'append'
                                ? 'дописано из записи приёма'
                                : 'заполнено из записи приёма'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevertVoiceField(voiceEntry)}
                              className="cursor-pointer hover:underline"
                            >
                              вернуть
                            </button>
                          </div>
                        )}
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
                          fieldMeta={section.fieldMeta}
                        />
                      </div>
                    );
                  })}
                </div>
                <div data-print-hide className="flex flex-col gap-3">
                  <div className="ml-6 min-h-5 text-[14px]" aria-live="polite">
                    {saveFailed ? (
                      <span className="text-[#D91528]">
                        Не сохранено — изменения остались только в браузере
                      </span>
                    ) : isSaving ? (
                      <span className="text-[#6C757D]">Сохранение…</span>
                    ) : hasUnsavedChanges ? (
                      <span className="text-[#F29100]">
                        Есть несохранённые изменения
                      </span>
                    ) : (
                      <span className="text-[#6C757D]">
                        Все изменения сохранены
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveAsTemplatePopup(true);
                      setIsFromPage(true);
                    }}
                    className="hover:bg-[#F0F5FF] text-[#202020] cursor-pointer bg-[#DCE7FF]  rounded-xl h-13 ml-6 px-6 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Сохранить как шаблон
                  </button>
                  <button
                    type="button"
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

          {showClinRecPanel && (
            <>
              <div
                data-print-hide
                className="w-2 mx-1 cursor-col-resize flex-shrink-0 flex items-center justify-center group"
                onMouseDown={handleDividerMouseDown}
              >
                <div className="w-0.5 h-12 bg-gray-300 rounded-full group-hover:bg-[#5D8CF1] transition-colors" />
              </div>
              <div
                data-print-hide
                className="mr-2 h-[calc(100vh-55px)] bg-white rounded-[15px] flex flex-col overflow-hidden flex-shrink-0"
                style={{ width: clinRecPanelWidth }}
              >
                <div className="flex items-start justify-between px-6.25 pt-5 border-[#E9ECEF]">
                  <h3 className="text-xl font-medium text-[#202020]">
                    Проверка протокола по клиническим рекомендациям
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseClinRecPanel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Image
                      alt="close"
                      src="/close.svg"
                      width={25}
                      height={25}
                    />
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
                              <p className="text-md">
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
                              <p className="text-md">
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
                              <p className="text-md">
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
            </>
          )}

          {isTranscriptPanelOpen && (
            <>
              <div
                data-print-hide
                className="w-2 mx-1 cursor-col-resize flex-shrink-0 flex items-center justify-center group"
                onMouseDown={handleDividerMouseDown}
              >
                <div className="w-0.5 h-12 bg-gray-300 rounded-full group-hover:bg-[#5D8CF1] transition-colors" />
              </div>
              <div
                data-print-hide
                className="mr-2 h-[calc(100vh-55px)] bg-white rounded-[15px] flex flex-col overflow-hidden flex-shrink-0"
                style={{ width: clinRecPanelWidth }}
              >
                <TranscriptPanel
                  items={transcripts.items}
                  isLoading={transcripts.isLoading}
                  failed={transcripts.failed}
                  selectedId={selectedTranscriptId}
                  onSelect={setSelectedTranscriptId}
                  onClose={() => setShowTranscriptPanel(false)}
                />
              </div>
            </>
          )}
        </>
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
