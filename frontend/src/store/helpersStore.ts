/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mainApi, UserSettings, UserSettingsPost } from '@/api';
import { ApiError } from '@/api/base-client';
import { toast } from 'react-toastify';
import { logError } from '@/lib/logger';

export type HelperId = 'mkb' | 'autocomplete' | 'fullness' | 'voice' | 'dms';

/**
 * Помощники, состояние которых хранится на сервере в `user_settings`.
 *
 * Запись приёма и проверка для ДМС в этот список не входят: в схеме
 * `user_settings` полей под них нет, и завести их может только backend
 * (для ДМС — E-7 в docs/plans/PL-314). До тех пор их флаги живут локально
 * (см. `persist` ниже) — настройка не переезжает на другое устройство.
 */
const SERVER_BACKED_HELPERS: HelperId[] = ['mkb', 'autocomplete', 'fullness'];
export type AutocompleteProvider =
  | 'ml_autocomplete'
  | 'dict_autocomplete'
  | 'off';

export interface HelperMeta {
  id: HelperId;
  name: string;
  icon: string;
  provider: string;
  url: string;
  likes: number;
  howItWorks: string;
  whenUseful: string;
  whenNotToRely: string;
}

interface HelpersStoreState {
  userSettings: UserSettings | null;
  isLoading: boolean;
  isApplying: boolean;

  selectedHelper: HelperId;

  mkbEnabled: boolean;
  fullnessEnabled: boolean;
  voiceEnabled: boolean;
  dmsEnabled: boolean;
  autocompleteProvider: AutocompleteProvider;

  setUserSettings: (settings: UserSettings) => void;
  setLoading: (loading: boolean) => void;
  setApplying: (applying: boolean) => void;
  setSelectedHelper: (helper: HelperId) => void;
  setAutocompleteProvider: (provider: AutocompleteProvider) => void;

  fetchUserSettings: (userId: string) => Promise<void>;
  updateHelperSetting: (
    userId: string,
    helperId: HelperId,
    params?: { autocompleteProvider?: AutocompleteProvider },
  ) => Promise<{ success: boolean; message: string }>;

  isHelperActive: (helperId: HelperId) => boolean;
  getHelperMeta: (helperId: HelperId) => HelperMeta | undefined;
}

export const HELPERS_META: Record<HelperId, HelperMeta> = {
  mkb: {
    id: 'mkb',
    name: 'Подбор кода диагноза МКБ-10',
    icon: '/mkb.svg',
    provider: 'VISMUTH',
    url: 'https://vismuth.ru',
    likes: 21,
    howItWorks:
      'Вы описываете диагноз в свободной форме. Помощник ищет наиболее подходящие коды МКБ-10 по смыслу',
    whenUseful:
      'Когда вы знаете диагноз, но не помните точный код или не хотите вручную листать справочник. Особенно удобен для нетипичных или редких формулировок',
    whenNotToRely:
      'Помощник может ошибиться, если в тексте несколько диагнозов или использована нестандартная терминология. Список кандидатов показывает оценку похожести — чем она ниже, тем менее уверен помощник',
  },
  autocomplete: {
    id: 'autocomplete',
    name: 'Автодополнение текста',
    icon: '/intelisense.svg',
    provider: 'VISMUTH',
    url: 'https://vismuth.ru',
    likes: 15,
    howItWorks:
      'Начните вводить текст — список вариантов появится автоматически. Нажмите на подходящий или продолжайте писать самостоятельно, если ни один не подходит',
    whenUseful:
      'Когда нужно быстро сформулировать типовую фразу — симптомы, жалобы, стандартные описания состояния. Экономит время на ввод повторяющихся формулировок',
    whenNotToRely:
      'Помощник не знает конкретного пациента и его истории. Он предлагает статистически частые продолжения из обучающих данных, а не клинически точные фразы для данного случая. Всегда проверяйте подсказку перед принятием',
  },
  voice: {
    id: 'voice',
    name: 'Запись приёма',
    icon: '/voice.svg',
    provider: 'VISMUTH',
    url: 'https://vismuth.ru',
    likes: 0,
    howItWorks:
      'Нажмите «Записать приём» в верхней панели протокола и ведите консультацию как обычно. После остановки записи речь распознаётся, а текст раскладывается по разделам протокола. Поля, заполненные из записи, подсвечены — каждое можно вернуть к прежнему виду',
    whenUseful:
      'Когда хочется вести приём, а не печатать: помощник заполняет разделы по ходу разговора и оставляет вам правку и проверку',
    whenNotToRely:
      'Помощник может распределить текст не по тем разделам, особенно если разговор шёл не по порядку. Проверяйте каждое заполненное поле: то, что вы написали руками, не заменяется — текст из записи дописывается ниже. Записывать приём можно только с согласия пациента',
  },
  fullness: {
    id: 'fullness',
    name: 'Проверка полноты полей',
    icon: '/fullness.svg',
    provider: 'VISMUTH',
    url: 'https://vismuth.ru',
    likes: 8,
    howItWorks:
      'Заполните раздел протокола и помощник автоматически проверит всё ли учтено. Если результат неполный, помощник покажет шаблон с маркерами `[...]` — вы можете взять его за основу и дополнить своими данными',
    whenUseful:
      'Когда хотите убедиться, что не упустили важные детали. Также полезен при обучении — помогает выработать привычку к структурированному описанию жалоб',
    whenNotToRely:
      'Помощник оценивает только текст, а не клиническую ситуацию. Если жалобы нетипичны или пациент общается с трудом, часть критериев может быть объективно невыполнима — это нормально. Зелёный сигнал означает полноту записи, а не полноту клинической картины',
  },
  dms: {
    id: 'dms',
    name: 'Проверка для ДМС',
    icon: '/check-all.svg',
    provider: 'VISMUTH',
    url: 'https://vismuth.ru',
    likes: 0,
    howItWorks:
      'Нажмите «Проверить для ДМС» в верхней панели протокола. Помощник подберёт клинические рекомендации по основному диагнозу и отметит в «Рекомендациях» и «Назначениях» препараты и процедуры, которых в них нет. Отмеченное можно убрать одной кнопкой или оставить раздел как был; рядом — фрагменты рекомендаций, по которым шла проверка',
    whenUseful:
      'Перед тем как отправить назначения на согласование страховой по ДМС: страховая оплачивает то, что подтверждается клиническими рекомендациями',
    whenNotToRely:
      'Помощник опирается только на клинические рекомендации, загруженные в систему, и не знает особенностей договора ДМС. Отметка значит «не нашли в рекомендациях», а не «назначение ошибочно» — решение остаётся за вами',
  },
};

export const AUTOCOMPLETE_OPTIONS: {
  value: AutocompleteProvider;
  label: string;
}[] = [
  { value: 'dict_autocomplete', label: 'Словарь' },
  { value: 'ml_autocomplete', label: 'Нейросеть' },
];

export const useHelpersStore = create<HelpersStoreState>()(
  persist(
    (set, get) => ({
      userSettings: null,
      isLoading: false,
      isApplying: false,
      selectedHelper: 'mkb',
      mkbEnabled: false,
      fullnessEnabled: false,
      // Запись приёма по умолчанию выключена: функция появляется в интерфейсе
      // только после того, как врач включил её в помощниках.
      voiceEnabled: false,
      // Проверка для ДМС по умолчанию выключена — так же, как запись приёма.
      dmsEnabled: false,
      autocompleteProvider: 'dict_autocomplete',

      setUserSettings: (settings) => set({ userSettings: settings }),
      setLoading: (isLoading) => set({ isLoading }),
      setApplying: (isApplying) => set({ isApplying }),
      setSelectedHelper: (selectedHelper) => set({ selectedHelper }),
      setAutocompleteProvider: (autocompleteProvider) =>
        set({ autocompleteProvider }),

      fetchUserSettings: async (userId: string) => {
        try {
          set({ isLoading: true });
          const settings = await mainApi.userSettings.getUserSettings(userId);
          set({ userSettings: settings });

          set({
            mkbEnabled: settings.mkb_code === true,
            fullnessEnabled: settings.fullness_complaints === true,
            autocompleteProvider:
              settings.autocomplete === 'off'
                ? 'off'
                : ((settings.autocomplete ??
                    'dict_autocomplete') as AutocompleteProvider),
          });
        } catch (error) {
          // 404 — это не сбой, а первый вход: строки настроек у пользователя ещё
          // нет. Заводим её со значениями по умолчанию, иначе экран настроек
          // помощников остаётся нерабочим (updateHelperSetting требует userSettings).
          if (error instanceof ApiError && error.status === 404) {
            try {
              const created = await mainApi.userSettings.postUserSettings(
                userId,
                {
                  mkb_code: true,
                  autocomplete: 'dict_autocomplete',
                  fullness_complaints: true,
                },
              );
              set({
                userSettings: created,
                mkbEnabled: created.mkb_code === true,
                fullnessEnabled: created.fullness_complaints === true,
                autocompleteProvider:
                  created.autocomplete === 'off'
                    ? 'off'
                    : ((created.autocomplete ??
                        'dict_autocomplete') as AutocompleteProvider),
              });
              return;
            } catch (createError) {
              logError('Failed to create default user settings:', createError);
              // Не показываем тост: помощники просто останутся выключенными.
              return;
            }
          }

          logError('Failed to fetch user settings:', error);
          toast.error('Не удалось загрузить настройки помощников');
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      updateHelperSetting: async (
        userId: string,
        helperId: HelperId,
        params?: { autocompleteProvider?: AutocompleteProvider },
      ) => {
        const {
          userSettings,
          autocompleteProvider,
          mkbEnabled,
          fullnessEnabled,
          voiceEnabled,
          dmsEnabled,
        } = get();

        if (!userSettings) {
          return { success: false, message: 'Настройки не загружены' };
        }

        try {
          set({ isApplying: true });

          const settingsPayload: Partial<Record<keyof UserSettingsPost, any>> =
            {};
          let toastMessage = '';
          const optimisticUpdate: Partial<HelpersStoreState> = {};

          switch (helperId) {
            case 'mkb': {
              const newValue = !mkbEnabled;
              settingsPayload.mkb_code = newValue;
              optimisticUpdate.mkbEnabled = newValue;
              toastMessage = newValue
                ? 'Помощник активирован'
                : 'Помощник выключен';
              break;
            }
            case 'autocomplete': {
              const currentProvider =
                params?.autocompleteProvider ?? autocompleteProvider;
              const wasActive = userSettings.autocomplete !== 'off';

              const initialProvider = userSettings.autocomplete;
              const isTypeChanged =
                wasActive && initialProvider !== currentProvider;

              if (!wasActive) {
                settingsPayload.autocomplete = currentProvider;
                toastMessage = 'Помощник активирован';
              } else if (isTypeChanged) {
                settingsPayload.autocomplete = currentProvider;
                toastMessage = 'Тип помощника успешно изменён';
              } else {
                settingsPayload.autocomplete = 'off';
                toastMessage = 'Помощник выключен';
              }

              optimisticUpdate.autocompleteProvider =
                settingsPayload.autocomplete as AutocompleteProvider;
              break;
            }
            case 'fullness': {
              const newValue = !fullnessEnabled;
              settingsPayload.fullness_complaints = newValue;
              optimisticUpdate.fullnessEnabled = newValue;
              toastMessage = newValue
                ? 'Помощник активирован'
                : 'Помощник выключен';
              break;
            }
            case 'voice': {
              // Сервер про этот помощник не знает: поля в `user_settings` нет.
              // Меняем только локальное состояние, запроса не будет.
              const newValue = !voiceEnabled;
              optimisticUpdate.voiceEnabled = newValue;
              toastMessage = newValue
                ? 'Помощник активирован'
                : 'Помощник выключен';
              break;
            }
            case 'dms': {
              // Как и запись приёма: поля в `user_settings` нет, флаг локальный.
              const newValue = !dmsEnabled;
              optimisticUpdate.dmsEnabled = newValue;
              toastMessage = newValue
                ? 'Помощник активирован'
                : 'Помощник выключен';
              break;
            }
          }

          set(optimisticUpdate);

          // Помощника, которого нет в схеме `user_settings`, сохранять
          // серверу нечем: запрос с пустым телом только зря переписал бы
          // `updated_at`.
          if (SERVER_BACKED_HELPERS.includes(helperId)) {
            await mainApi.userSettings.patchUserSettings(
              userId,
              settingsPayload as UserSettingsPost,
            );
          }

          if (toastMessage) {
            toast.success(toastMessage);
          }

          set((state) => {
            if (!state.userSettings) return state;
            const updated: UserSettings = { ...state.userSettings };

            if (helperId === 'mkb' && settingsPayload.mkb_code !== undefined) {
              updated.mkb_code = settingsPayload.mkb_code;
            }
            if (helperId === 'autocomplete' && settingsPayload.autocomplete) {
              updated.autocomplete = settingsPayload.autocomplete;
            }
            if (
              helperId === 'fullness' &&
              settingsPayload.fullness_complaints !== undefined
            ) {
              updated.fullness_complaints = settingsPayload.fullness_complaints;
            }
            updated.updated_at = new Date().toISOString();

            return { userSettings: updated };
          });

          return { success: true, message: toastMessage };
        } catch (error) {
          logError('Failed to update helper setting:', error);
          toast.error('Не удалось применить настройки');

          await get().fetchUserSettings(userId);

          return { success: false, message: 'Ошибка при обновлении' };
        } finally {
          set({ isApplying: false });
        }
      },

      isHelperActive: (helperId: HelperId) => {
        const {
          userSettings,
          mkbEnabled,
          fullnessEnabled,
          voiceEnabled,
          dmsEnabled,
          autocompleteProvider,
        } = get();

        switch (helperId) {
          case 'mkb':
            return mkbEnabled ?? userSettings?.mkb_code === true;
          case 'autocomplete':
            return autocompleteProvider !== 'off';
          case 'fullness':
            return (
              fullnessEnabled ?? userSettings?.fullness_complaints === true
            );
          case 'voice':
            return voiceEnabled;
          case 'dms':
            return dmsEnabled;
          default:
            return false;
        }
      },

      getHelperMeta: (helperId: HelperId) => HELPERS_META[helperId],
    }),
    {
      // Сохраняются только флаги записи приёма и обоснования для ДМС: у
      // остальных помощников источник истины — `user_settings` на сервере,
      // и дублировать их локально нельзя, иначе состояния разойдутся.
      name: 'helpers-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        voiceEnabled: state.voiceEnabled,
        dmsEnabled: state.dmsEnabled,
      }),
    },
  ),
);
