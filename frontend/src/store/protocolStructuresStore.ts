import { create } from 'zustand';
import { mainApi } from '@/api';
import type { ProtocolStructures, ProtocolStructuresFields } from '@/api';
import { logError } from '@/lib/logger';

interface ProtocolStructuresState {
  structures: ProtocolStructures[];
  selectedStructure: ProtocolStructuresFields | null;
  structuresCache: Record<string, ProtocolStructuresFields>;
  isLoading: boolean;
  error: string | null;

  fetchStructures: () => Promise<void>;
  fetchStructureById: (id: string) => Promise<ProtocolStructuresFields | null>;
  setSelectedStructure: (structure: ProtocolStructuresFields | null) => void;
  clearCache: () => void;
  reset: () => void;
}

export const useProtocolStructuresStore = create<ProtocolStructuresState>(
  (set, get) => ({
    structures: [],
    selectedStructure: null,
    structuresCache: {},
    isLoading: false,
    error: null,

    fetchStructures: async () => {
      set({ isLoading: true, error: null });
      try {
        const data = await mainApi.protocol_structures.getProtocolStructures();
        set({
          structures: data.filter((s) => s.is_active),
          isLoading: false,
        });
      } catch (e) {
        set({ error: 'Не удалось загрузить структуры', isLoading: false });
        logError('Fetch structures error:', e);
      }
    },

    fetchStructureById: async (
      id: string,
    ): Promise<ProtocolStructuresFields | null> => {
      const cached = get().structuresCache[id];
      if (cached) {
        set({ selectedStructure: cached });
        return cached;
      }

      try {
        const structure =
          await mainApi.protocol_structures.getProtocolStructuresById(id);

        set((state) => ({
          selectedStructure: structure,
          structuresCache: {
            ...state.structuresCache,
            [id]: structure,
          },
        }));

        return structure;
      } catch (e) {
        logError('Fetch structure by id error:', e);
        set({ error: 'Не удалось загрузить структуру' });
        return null;
      }
    },

    setSelectedStructure: (structure) => set({ selectedStructure: structure }),

    clearCache: () => set({ structuresCache: {} }),

    reset: () =>
      set({
        selectedStructure: null,
        error: null,
        structuresCache: {},
      }),
  }),
);
