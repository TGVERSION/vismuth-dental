'use client';

import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface DoctorsHelpersProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DoctorsHelpers: React.FC<DoctorsHelpersProps> = ({
  isOpen,
  onClose,
}) => {
  useLockBodyScroll(isOpen);
  if (!isOpen) return null;
  const closeModal = () => {
    onClose();
  };

  return (
    <>
      <div
        className="modal-overlay fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-2xl min-h-[calc(100vh-80px)]"
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
                    <div
                      className="px-3.75 py-3 rounded-lg cursor-pointer transition-all
                           hover:bg-white shadow-custom-hover
                          "
                    >
                      <div className="flex items-center gap-3.75">
                        <Image
                          alt="mkb"
                          src="/mkb.svg"
                          width={46}
                          height={46}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-md text-[#202020]">
                            Подбор кода диагноза МКБ-10
                          </span>
                          <span className="text-sm text-[#6C757D]">
                            VISMUTH
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="px-3.75 py-3 rounded-lg cursor-pointer transition-all
                            hover:bg-white shadow-custom-hover
                          "
                    >
                      <div className="flex items-center gap-3.75">
                        <Image
                          alt="mkb"
                          src="/intelisense.png"
                          width={46}
                          height={46}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-md text-[#202020]">
                            Автодополнение текста
                          </span>
                          <span className="text-sm text-[#6C757D]">
                            VISMUTH
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="px-3.75 py-3 rounded-lg cursor-pointer transition-all
                            hover:bg-white shadow-custom-hover
                          "
                    >
                      <div className="flex items-center gap-3.75">
                        <Image
                          alt="mkb"
                          src="/fullness.png"
                          width={46}
                          height={46}
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-md text-[#202020]">
                            Проверка полноты полей
                          </span>
                          <span className="text-sm text-[#6C757D]">
                            VISMUTH
                          </span>
                        </div>
                      </div>
                    </div>
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
                true && (
                  <div>
                    <div className="flex items-center justify-between pb-6 px-8">
                      <div className="flex items-center gap-3">
                        <Image
                          alt="mkb"
                          src="/mkb.svg"
                          width={110}
                          height={110}
                        />
                        <div className="flex flex-col gap-1">
                          <h3 className="text-3xl text-[#202020]">
                            Подбор кода диагноза МКБ-10
                          </h3>
                          <div className="flex flex-row gap-3 items-center">
                            <p className="text-[#6C757D] text-sm">VISMUTH</p>
                            <a
                              href="https://vismuth.ru"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#5D8CF1] text-sm"
                            >
                              vismuth.ru
                            </a>
                            <div className="border-r border-[#E9ECEF] h-5"></div>
                            <div className="flex flex-row gap-2 items-center">
                              <Image
                                alt="like"
                                src="/like.svg"
                                width={20}
                                height={20}
                              />
                              <p className="text-[#909090] text-sm">21</p>
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
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
