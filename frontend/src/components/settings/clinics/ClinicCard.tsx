'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { CustomDropdown } from '@/components/CustomDropdown';
import { SafeImage } from '@/components/SafeImage';
import { useClinicCard } from '@/hooks/useClinicCard';
import { useClinicMembers } from '@/hooks/useClinicMembers';
import { useSpecializations } from '@/hooks/useSpecializations';
import { sanitizeBrandColor } from '@/lib/branding';
import { fieldFillClass } from '@/lib/field-fill';
import {
  ACCESS_TYPE_OPTIONS,
  QUESTIONNAIRE_KIND_OPTIONS,
  canAddDoctor as checkCanAddDoctor,
  doctorsLimitOptions,
  filterOptions,
  formatPhone,
  normalizePhone,
  type MemberRole,
} from '@/lib/clinics';
import type { ClinicAccessType, ClinicQuestionnaireKind } from '@/api';
import { ClinicAdminsField } from './ClinicAdminsField';
import { ClinicDateField } from './ClinicDateField';
import { ClinicMembers } from './ClinicMembers';
import { ErrorState, FieldRow, INPUT_CLASS, Spinner } from './fields';
import { InviteMemberModal } from './InviteMemberModal';

interface ClinicCardProps {
  /** null — новая клиника: создаётся, когда заполнены обязательные поля. */
  clinicId: string | null;
}

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.currentTarget.blur();
};

export const ClinicCard = ({ clinicId }: ClinicCardProps) => {
  const baseId = useId();
  const card = useClinicCard(clinicId);
  const members = useClinicMembers(card.saved?.id ?? null);
  const { specializations } = useSpecializations();
  const [limitQuery, setLimitQuery] = useState('');
  const [inviteRoles, setInviteRoles] = useState<MemberRole[] | null>(null);

  if (card.loading) return <Spinner />;
  if (card.loadError) {
    return (
      <ErrorState text="Не удалось загрузить клинику" onRetry={card.reload} />
    );
  }

  const { draft, errors, saved } = card;
  const canAddDoctor = saved ? checkCanAddDoctor(saved) : false;

  const limitOptions = filterOptions(
    doctorsLimitOptions(draft.doctors_limit).map((value) => ({
      value,
      label: String(value),
    })),
    limitQuery,
    [draft.doctors_limit],
  );

  const commitPhone = () => {
    const normalized = normalizePhone(draft.phone);
    if (normalized) card.setField('phone', formatPhone(normalized));
    card.commitField('phone');
  };

  const brandColor = sanitizeBrandColor(draft.brand_color);

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-8 pb-6">
        <h3 className="min-w-0 truncate text-3xl font-medium text-[#202020]">
          {saved?.name || 'Новая клиника'}
        </h3>
        <span role="status" className="shrink-0 text-sm text-[#6C757D]">
          {card.isSaving ? 'Сохраняется…' : saved ? 'Сохранено' : ''}
        </span>
      </div>

      <section className="px-8 pb-8" aria-labelledby={`${baseId}-clinic`}>
        <h4
          id={`${baseId}-clinic`}
          className="mb-3 text-[30px] font-medium text-[#202020]"
        >
          Клиника
        </h4>

        {!saved && (
          <p className="mb-2 text-sm text-[#6C757D]">
            Клиника сохранится, когда будут заполнены название, тип и период
            доступа
          </p>
        )}

        <FieldRow
          label="Название клиники"
          htmlFor={`${baseId}-name`}
          error={errors.name}
        >
          <input
            id={`${baseId}-name`}
            type="text"
            value={draft.name}
            onChange={(event) => card.setField('name', event.target.value)}
            onBlur={() => card.commitField('name')}
            onKeyDown={blurOnEnter}
            maxLength={255}
            className={`${INPUT_CLASS} ${fieldFillClass(draft.name)}`}
          />
        </FieldRow>

        <FieldRow label="Администраторы" htmlFor={`${baseId}-admins`}>
          <ClinicAdminsField
            id={`${baseId}-admins`}
            members={members.members}
            disabled={!saved || members.loading}
            onPatch={members.patchMember}
            onInviteAdmin={() => setInviteRoles(['admin'])}
          />
        </FieldRow>

        <FieldRow label="Тип доступа" error={errors.access_type}>
          <CustomDropdown<ClinicAccessType>
            options={ACCESS_TYPE_OPTIONS}
            value={draft.access_type as ClinicAccessType}
            onChange={(value) => card.setAndCommit('access_type', value)}
            triggerClassName={fieldFillClass(draft.access_type)}
            aria-label="Тип доступа"
          />
        </FieldRow>

        {/* Подсказка — по сохранённому значению: при неудачном сохранении
            она не должна выдавать желаемое за действительное. */}
        <FieldRow
          label="Анкета пациента"
          error={errors.questionnaire_kind}
          hint={
            (saved?.questionnaire_kind ?? draft.questionnaire_kind) === 'dental'
              ? 'По персональным ссылкам от регистратуры. Если переключить на общую, у регистратуры пропадёт раздел «Анкеты пациентов», а начатые анкеты пациенты дозаполнят'
              : 'По ссылке и QR врача или клиники'
          }
        >
          <CustomDropdown<ClinicQuestionnaireKind>
            options={QUESTIONNAIRE_KIND_OPTIONS}
            value={draft.questionnaire_kind}
            onChange={(value) => card.setAndCommit('questionnaire_kind', value)}
            triggerClassName={fieldFillClass(draft.questionnaire_kind)}
            aria-label="Анкета пациента"
          />
        </FieldRow>

        <FieldRow
          label="Лимит врачей"
          error={errors.doctors_limit}
          note={saved ? `Сейчас врачей: ${saved.doctors_count}` : null}
        >
          <CustomDropdown<number>
            options={limitOptions}
            value={draft.doctors_limit}
            onChange={(value) => card.setAndCommit('doctors_limit', value)}
            onSearch={setLimitQuery}
            triggerClassName={fieldFillClass(draft.doctors_limit)}
            aria-label="Лимит врачей"
          />
        </FieldRow>

        <FieldRow
          label="Период доступа"
          htmlFor={`${baseId}-until`}
          error={errors.access_until}
        >
          <ClinicDateField
            id={`${baseId}-until`}
            value={draft.access_until}
            onChange={(value) => card.setAndCommit('access_until', value)}
          />
        </FieldRow>

        <FieldRow
          label="Телефон клиники"
          htmlFor={`${baseId}-phone`}
          error={errors.phone}
        >
          <input
            id={`${baseId}-phone`}
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(event) => card.setField('phone', event.target.value)}
            onBlur={commitPhone}
            onKeyDown={blurOnEnter}
            placeholder="+7 ___ ___-__-__"
            className={`${INPUT_CLASS} ${fieldFillClass(draft.phone)}`}
          />
        </FieldRow>

        <FieldRow
          label="Логотип"
          hint="Ссылка на картинку"
          htmlFor={`${baseId}-logo`}
          error={errors.logo_url}
        >
          <input
            id={`${baseId}-logo`}
            type="url"
            value={draft.logo_url}
            onChange={(event) => card.setField('logo_url', event.target.value)}
            onBlur={() => card.commitField('logo_url')}
            onKeyDown={blurOnEnter}
            placeholder="https://…"
            className={`${INPUT_CLASS} ${fieldFillClass(draft.logo_url)}`}
          />
          {saved?.logo_url && (
            <div
              className="mt-2 inline-flex rounded-lg p-2"
              style={{ backgroundColor: brandColor ?? undefined }}
            >
              <SafeImage
                src={saved.logo_url}
                alt={`Логотип ${saved.name}`}
                width={120}
                height={32}
                className="h-8 w-auto object-contain"
              />
            </div>
          )}
        </FieldRow>

        <FieldRow
          label="Цвет на фон за логотипом"
          htmlFor={`${baseId}-color`}
          error={errors.brand_color}
        >
          <div
            className={`flex h-10 items-center gap-2 rounded-xl ${fieldFillClass(draft.brand_color)} px-3.5 focus-within:ring-2 focus-within:ring-[#5D8CF1]`}
          >
            <input
              type="color"
              value={brandColor ?? '#FFFFFF'}
              onChange={(event) =>
                card.setField('brand_color', event.target.value.toUpperCase())
              }
              onBlur={() => card.commitField('brand_color')}
              aria-label="Выбрать цвет"
              // Образец цвета 16×16 без рамки: у нативного поля цвета вокруг
              // заливки есть отступ и серая обводка — снимаем их.
              className="h-4 w-4 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
            <input
              id={`${baseId}-color`}
              type="text"
              value={draft.brand_color}
              onChange={(event) =>
                card.setField('brand_color', event.target.value)
              }
              onBlur={() => card.commitField('brand_color')}
              onKeyDown={blurOnEnter}
              placeholder="#C9CAFF"
              maxLength={7}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#202020] outline-none placeholder:text-[#A0A7B0]"
            />
          </div>
        </FieldRow>
      </section>

      <div className="border-t border-gray-200 px-8 py-8">
        {saved ? (
          <ClinicMembers
            state={members}
            canAddDoctor={canAddDoctor}
            specializations={specializations}
            onAdd={() => setInviteRoles(['doctor'])}
            onDoctorsChanged={card.refreshSaved}
          />
        ) : (
          <p className="text-sm text-[#6C757D]">
            Сотрудников можно будет добавить после сохранения клиники
          </p>
        )}
      </div>

      {inviteRoles && saved && (
        <InviteMemberModal
          defaultRoles={inviteRoles}
          canAddDoctor={canAddDoctor}
          specializations={specializations}
          onInvite={async (data) => {
            const result = await members.invite(data);
            if (result.ok && data.is_doctor) card.refreshSaved();
            return result;
          }}
          onClose={() => setInviteRoles(null)}
        />
      )}
    </>
  );
};
