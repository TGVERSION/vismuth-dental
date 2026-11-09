'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { mainApi } from '@/api';
import type { DictionaryNames } from '@/api';
import { EditDictionaryModal } from './EditDictionaryModal';

export function DirectoriesSection() {
  const [directories, setDirectories] = useState<DictionaryNames[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDict, setSelectedDict] = useState<DictionaryNames | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    mainApi.dictionary
      .getDictionary()
      .then((data) => {
        if (cancelled) return;
        setDirectories(data);
        setIsLoading(false);

        data.forEach((dict) => {
          mainApi.dictionary
            .getDictionaryRef(dict.name, { limit: 1 })
            .then((result) => {
              if (!cancelled)
                setCounts((prev) => ({ ...prev, [dict.name]: result.total }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Не удалось загрузить справочники');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openDict = (dict: DictionaryNames) => {
    setSelectedDict(dict);
    setIsModalOpen(true);
    setModalKey((k) => k + 1);
  };

  return (
    <>
      <div className="flex items-center justify-between pb-6 border-b px-8 border-gray-200">
        <h3 className="text-3xl font-medium text-[var(--ui-color-alabaster-dark-800)]">
          Справочники
        </h3>
      </div>

      <div className="px-8 py-5">
        {isLoading ? (
          <div className="animate-spin mx-auto my-40 rounded-full h-10 w-10 border-b-2 border-[var(--ui-color-blue-600)]"></div>
        ) : directories.length === 0 ? (
          <p className="text-sm text-gray-400">Нет справочников</p>
        ) : (
          <div className="flex flex-col gap-2">
            {directories.map((dict) => (
              <div
                key={dict.id}
                className={`flex items-center px-[var(--ui-space-14)] py-3 rounded-lg cursor-pointer transition-all shadow-custom-hover`}
                onClick={() => openDict(dict)}
              >
                <span className="text-md text-[var(--ui-color-alabaster-dark-800)]">
                  {dict.name}
                </span>
                {counts[dict.name] !== undefined && (
                  <sup className="ml-1 text-xs text-[var(--ui-color-blue-600)]">
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
