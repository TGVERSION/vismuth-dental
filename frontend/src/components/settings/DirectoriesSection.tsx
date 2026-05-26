'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import type { DictionaryNames } from '@/api';
import { EditDictionaryModal } from './EditDictionaryModal';

export function DirectoriesSection() {
  const [directories, setDirectories] = useState<DictionaryNames[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDict, setSelectedDict] = useState<DictionaryNames | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  const loadDirectories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mainApi.dictionary.getDictionary();
      setDirectories(data);

      const countResults = await Promise.allSettled(
        data.map((dict) =>
          mainApi.dictionary.getDictionaryRef(dict.name, { limit: 1 }),
        ),
      );
      const newCounts: Record<string, number> = {};
      countResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          newCounts[data[i].name] = result.value.total;
        }
      });
      setCounts(newCounts);
    } catch {
      toast.error('Не удалось загрузить справочники');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  const openDict = (dict: DictionaryNames) => {
    setSelectedDict(dict);
    setIsModalOpen(true);
    setModalKey((k) => k + 1);
  };

  const createNew = () => {
    setSelectedDict(null);
    setIsModalOpen(true);
    setModalKey((k) => k + 1);
  };

  return (
    <>
      <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
        <h3 className="text-3xl font-medium text-[#202020]">Справочники</h3>
        <button
          type="button"
          onClick={createNew}
          className="px-5 py-2.5 bg-[#5D8CF1] hover:bg-[#769CEF] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          Создать новый
        </button>
      </div>

      <div className="px-8 py-5">
        {isLoading ? (
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[#5D8CF1]"></div>
        ) : directories.length === 0 ? (
          <p className="text-sm text-gray-400">Нет справочников</p>
        ) : (
          <div className="flex flex-col gap-2">
            {directories.map((dict) => (
              <div
                key={dict.id}
                className={`flex items-center px-3.75 py-3 rounded-lg cursor-pointer transition-all shadow-custom-hover`}
                onClick={() => openDict(dict)}
              >
                <span className="text-md text-[#202020]">{dict.name}</span>
                {counts[dict.name] !== undefined && (
                  <sup className="ml-1 text-xs text-[#5D8CF1]">
                    {counts[dict.name].toLocaleString('ru-RU')}
                  </sup>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <EditDictionaryModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dictionary={selectedDict}
      />
    </>
  );
}
