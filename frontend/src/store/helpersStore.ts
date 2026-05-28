/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { mainApi, UserSettings, UserSettingsPost } from '@/api';
import { toast } from 'react-toastify';

export type HelperId = 'mkb' | 'autocomplete' | 'fullness';
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
};

export const AUTOCOMPLETE_OPTIONS: {
  value: AutocompleteProvider;
  label: string;
}[] = [
  { value: 'dict_autocomplete', label: 'Словарь' },
  { value: 'ml_autocomplete', label: 'Нейросеть' },
];

export const useHelpersStore = create<HelpersStoreState>((set, get) => ({
  userSettings: null,
  isLoading: false,
  isApplying: false,
  selectedHelper: 'mkb',
  mkbEnabled: false,
  fullnessEnabled: false,
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
            : ((settings.autocomplete ?? 'dict_autocomplete') as AutocompleteProvider),
      });
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
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
      isHelperActive,
    } = get();

    if (!userSettings) {
      return { success: false, message: 'Настройки не загружены' };
    }

    try {
      set({ isApplying: true });

      const wasActive = isHelperActive(helperId);
      const settingsPayload: Partial<Record<keyof UserSettingsPost, any>> = {};
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
      }

      set(optimisticUpdate);

      await mainApi.userSettings.patchUserSettings(
        userId,
        settingsPayload as UserSettingsPost,
      );

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
      console.error('Failed to update helper setting:', error);
      toast.error('Не удалось применить настройки');

      await get().fetchUserSettings(userId);

      return { success: false, message: 'Ошибка при обновлении' };
    } finally {
      set({ isApplying: false });
    }
  },

  isHelperActive: (helperId: HelperId) => {
    const { userSettings, mkbEnabled, fullnessEnabled, autocompleteProvider } =
      get();

    switch (helperId) {
      case 'mkb':
        return mkbEnabled ?? userSettings?.mkb_code === true;
      case 'autocomplete':
        return autocompleteProvider !== 'off';
      case 'fullness':
        return fullnessEnabled ?? userSettings?.fullness_complaints === true;
      default:
        return false;
    }
  },

  getHelperMeta: (helperId: HelperId) => HELPERS_META[helperId],
}));
