'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Helper {
  id: 'mkb' | 'autocomplete' | 'fullness';
  name: string;
  icon: string;
  provider: string;
  url: string;
  likes: number;
  howItWorks: string;
  whenUseful: string;
  whenNotToRely: string;
}

interface DoctorsHelpersProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpers: Helper[] = [
  {
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
  {
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
  {
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
];

export const DoctorsHelpers: React.FC<DoctorsHelpersProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedHelper, setSelectedHelper] = useState<Helper['id']>('mkb');

  if (!isOpen) return null;

  const closeModal = () => {
    onClose();
  };

  const currentHelper =
    helpers.find((h) => h.id === selectedHelper) || helpers[0];

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-1">
            <div className="border-r border-[#E9ECEF] p-8 flex gap-4 flex-col max-w-102.25">
              <h2 className="text-[34px] font-semibold text-[#202020]">
                Помощники
              </h2>
              {false ? (
                <div className="text-center text-gray-500 py-8">
                  Загрузка...
                </div>
              ) : false ? (
                <div className="text-center text-md">Помощники не найдены</div>
              ) : (
                <div className="space-y-4.5">
                  <div>
                    {helpers.map((helper) => (
                      <div
                        key={helper.id}
                        className={`px-3.75 py-3 rounded-lg cursor-pointer transition-all
                             hover:bg-white shadow-custom-hover
                            ${helper.id === selectedHelper && 'bg-white shadow-custom'}`}
                        onClick={() => setSelectedHelper(helper.id)}
                      >
                        <div className="flex items-center gap-3.75">
                          <Image
                            alt={helper.id}
                            src={helper.icon}
                            width={46}
                            height={46}
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-md text-[#202020]">
                              {helper.name}
                            </span>
                            <span className="text-sm text-[#6C757D]">
                              {helper.provider}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="mt-2.5 mr-2.5 cursor-pointer transition-colors"
                >
                  <Image alt="close" src="/close.svg" width={25} height={25} />
                </button>
              </div>

              {false ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    Загрузка шаблона...
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between pb-6 px-8">
                    <div className="flex items-center gap-3">
                      <Image
                        alt={currentHelper.id}
                        src={currentHelper.icon}
                        width={110}
                        height={110}
                      />
                      <div className="flex flex-col gap-1">
                        <h3 className="text-3xl text-[#202020]">
                          {currentHelper.name}
                        </h3>
                        <div className="flex flex-row gap-3 items-center">
                          <p className="text-[#6C757D] text-sm">
                            {currentHelper.provider}
                          </p>
                          <a
                            href={currentHelper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5D8CF1] text-sm"
                          >
                            {currentHelper.url.replace('https://', '')}
                          </a>
                          <div className="border-r border-[#E9ECEF] h-5"></div>
                          <div className="flex flex-row gap-2 items-center">
                            <Image
                              alt="like"
                              src="/like.svg"
                              width={20}
                              height={20}
                            />
                            <p className="text-[#909090] text-sm">
                              {currentHelper.likes}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-5.5 py-2.5 flex items-center h-9.5 bg-[#5D8CF1] cursor-pointer text-white rounded-lg hover:bg-[#769CEF] transition-colors">
                        Применить
                      </button>
                    </div>
                  </div>

                  {/* Новые поля для заполнения */}
                  <div className="px-8 pb-8 space-y-6">
                    {currentHelper.howItWorks && (
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[24px] font-medium">
                          Как работает
                        </h4>
                        <p className="text-md">{currentHelper.howItWorks}</p>
                      </div>
                    )}
                    {currentHelper.whenUseful && (
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[24px] font-medium">
                          Когда полезен
                        </h4>
                        <p className="text-md">{currentHelper.whenUseful}</p>
                      </div>
                    )}
                    {currentHelper.whenNotToRely && (
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[24px] font-medium">
                          Когда не стоит полагаться
                        </h4>
                        <p className="text-md">{currentHelper.whenNotToRely}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
