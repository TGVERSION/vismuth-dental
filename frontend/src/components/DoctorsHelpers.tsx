'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/store/authStore';
import { SpinnerButton } from './SpinnerButton';
import {
  useHelpersStore,
  HelperId,
  AUTOCOMPLETE_OPTIONS,
  AutocompleteProvider,
} from '@/store/helpersStore';

/** Порядок карточек в списке помощников. */
const HELPER_ORDER: HelperId[] = [
  'mkb',
  'autocomplete',
  'fullness',
  'voice',
  'dms',
];

interface DoctorsHelpersProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DoctorsHelpers: React.FC<DoctorsHelpersProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuthStore();

  const {
    userSettings,
    isLoading,
    isApplying,
    selectedHelper,
    mkbEnabled,
    fullnessEnabled,
    voiceEnabled,
    dmsEnabled,
    autocompleteProvider,
    setSelectedHelper,
    setAutocompleteProvider,
    fetchUserSettings,
    updateHelperSetting,
    getHelperMeta,
  } = useHelpersStore();

  const closeModal = () => onClose();
  const currentHelper = getHelperMeta(selectedHelper);

  const { applyButtonText, applyButtonClass } = useMemo(() => {
    let isActive = false;

    if (selectedHelper === 'mkb') {
      isActive = mkbEnabled;
    } else if (selectedHelper === 'fullness') {
      isActive = fullnessEnabled;
    } else if (selectedHelper === 'voice') {
      isActive = voiceEnabled;
    } else if (selectedHelper === 'dms') {
      isActive = dmsEnabled;
    } else if (selectedHelper === 'autocomplete') {
      isActive =
        autocompleteProvider !== 'off' &&
        userSettings?.autocomplete === autocompleteProvider;
    }

    if (selectedHelper === 'autocomplete') {
      return {
        applyButtonText: isActive ? 'Выключить' : 'Применить',
        applyButtonClass: isActive
          ? 'vismuth-button--danger'
          : 'vismuth-button--primary',
      };
    }

    return {
      applyButtonText: isActive ? 'Выключить' : 'Применить',
      applyButtonClass: isActive
        ? 'vismuth-button--danger'
        : 'vismuth-button--primary',
    };
  }, [
    selectedHelper,
    mkbEnabled,
    fullnessEnabled,
    voiceEnabled,
    dmsEnabled,
    autocompleteProvider,
    userSettings?.autocomplete,
  ]);

  useEffect(() => {
    if (
      isOpen &&
      selectedHelper === 'autocomplete' &&
      autocompleteProvider !== 'off' &&
      userSettings?.autocomplete &&
      userSettings.autocomplete !== 'off' &&
      userSettings.autocomplete !== autocompleteProvider
    ) {
      const userId = user?.id;
      if (userId) {
        updateHelperSetting(userId, 'autocomplete', { autocompleteProvider });
      }
    }
  }, [
    isOpen,
    selectedHelper,
    autocompleteProvider,
    userSettings?.autocomplete,
    user?.id,
    updateHelperSetting,
  ]);

  useEffect(() => {
    const userId = user?.id;
    if (!isOpen || !userId) return;

    fetchUserSettings(userId).catch(() => {});
  }, [isOpen, user?.id, fetchUserSettings]);

  if (!isOpen) return null;
  if (!currentHelper) return null;

  const handleApply = async () => {
    const userId = user?.id;
    if (!userId) {
      toast.error('Пользователь не авторизован');
      return;
    }

    await updateHelperSetting(userId, selectedHelper, {
      autocompleteProvider:
        selectedHelper === 'autocomplete' ? autocompleteProvider : undefined,
    });
  };

  return (
    <>
      <div
        className="modal-overlay px-4 fixed inset-0 flex items-start justify-center z-50 pt-10 pb-10 overflow-y-auto"
        onClick={closeModal}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-334.5 flex flex-col shadow-[var(--ui-shadow)] min-h-[calc(100vh-80px)] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 flex-1 flex-col md:flex-row">
            <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--ui-color-alabaster-500)] p-4 md:w-64 md:border-r md:border-b-0 md:p-6">
              <h2 className="text-[length:var(--ui-font-size-34)] font-semibold text-[var(--ui-color-alabaster-dark-800)]">
                Помощники
              </h2>
              <div className="space-y-2">
                {HELPER_ORDER.map((helperId) => {
                  const meta = getHelperMeta(helperId);
                  if (!meta) return null;

                  return (
                    <div
                      key={helperId}
                      className={`px-[var(--ui-space-14)] py-3 rounded-lg cursor-pointer transition-all hover:bg-white shadow-custom-hover ${
                        helperId === selectedHelper
                          ? 'bg-white shadow-custom'
                          : ''
                      }`}
                      onClick={() => setSelectedHelper(helperId)}
                    >
                      <div className="flex items-center gap-[var(--ui-space-14)]">
                        <Image
                          alt={helperId}
                          src={meta.icon}
                          width={46}
                          height={46}
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-md text-[var(--ui-color-alabaster-dark-800)]">
                              {meta.name}
                            </span>
                          </div>
                          <span className="text-sm text-[var(--ui-color-alabaster-950)]">
                            {meta.provider}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="vismuth-icon-button mt-[var(--ui-space-10)] mr-[var(--ui-space-10)] cursor-pointer transition-colors"
                >
                  <Image alt="close" src="/close.svg" width={25} height={25} />
                </button>
              </div>

              <div>
                <div className="flex flex-wrap items-start justify-between gap-4 pb-6 px-4 md:px-8">
                  <div className="flex items-center gap-3">
                    <Image
                      alt={currentHelper.id}
                      src={currentHelper.icon}
                      width={90}
                      height={90}
                    />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-3xl text-[var(--ui-color-alabaster-dark-800)]">
                        {currentHelper.name}
                      </h3>
                      <div className="flex flex-wrap gap-3 items-center">
                        <p className="text-[var(--ui-color-alabaster-950)] text-sm">
                          {currentHelper.provider}
                        </p>
                        <a
                          href={currentHelper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--ui-color-blue-600)] text-sm"
                        >
                          {currentHelper.url.replace('https://', '')}
                        </a>
                        <div className="border-r border-[var(--ui-color-slate-200)] h-5" />
                        <div className="flex flex-row gap-2 items-center">
                          <Image
                            alt="like"
                            src="/like.svg"
                            width={20}
                            height={20}
                          />
                          <p className="text-[var(--ui-color-alabaster-950)] text-sm">
                            {currentHelper.likes}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedHelper === 'autocomplete' && (
                      <div className="w-48">
                        <CustomDropdown<AutocompleteProvider, false>
                          options={
                            AUTOCOMPLETE_OPTIONS as DropdownOption<AutocompleteProvider>[]
                          }
                          value={autocompleteProvider}
                          onChange={(value) => setAutocompleteProvider(value)}
                          disabled={isApplying || isLoading}
                          className="h-10"
                          dropdownClassName="z-[10000]"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={
                        isApplying ||
                        isLoading ||
                        (selectedHelper === 'autocomplete' &&
                          autocompleteProvider === 'off' &&
                          userSettings?.autocomplete === 'off')
                      }
                      className={`min-w-28 ${applyButtonClass}`}
                    >
                      {isApplying ? <SpinnerButton /> : applyButtonText}
                    </button>
                  </div>
                </div>

                <div className="px-8 pb-8 space-y-6">
                  {currentHelper.howItWorks && (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-[length:var(--ui-font-size-23)] font-medium">
                        Как работает
                      </h4>
                      <p className="text-md">{currentHelper.howItWorks}</p>
                    </div>
                  )}
                  {currentHelper.whenUseful && (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-[length:var(--ui-font-size-23)] font-medium">
                        Когда полезен
                      </h4>
                      <p className="text-md">{currentHelper.whenUseful}</p>
                    </div>
                  )}
                  {currentHelper.whenNotToRely && (
                    <div className="flex flex-col gap-3">
                      <h4 className="text-[length:var(--ui-font-size-23)] font-medium">
                        Когда не стоит полагаться
                      </h4>
                      <p className="text-md">{currentHelper.whenNotToRely}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
