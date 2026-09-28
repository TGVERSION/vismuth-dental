'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { ClinicMemberPatch, ClinicMemberRead } from '@/api';
import { CustomDropdown } from '@/components/CustomDropdown';
import { clinicAdminOptions, filterOptions } from '@/lib/clinics';
import { fieldFillClass } from '@/lib/field-fill';
import { LINK_BUTTON_CLASS } from './fields';

interface ClinicAdminsFieldProps {
  id?: string;
  members: ClinicMemberRead[];
  disabled: boolean;
  onPatch: (memberId: string, data: ClinicMemberPatch) => Promise<boolean>;
  onInviteAdmin: () => void;
}

/**
 * Администраторы клиники — не поле клиники, а флаг `is_clinic_admin` у
 * сотрудников. Отметка в списке сохраняется сразу.
 */
export const ClinicAdminsField = ({
  id,
  members,
  disabled,
  onPatch,
  onInviteAdmin,
}: ClinicAdminsFieldProps) => {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { options, selected } = clinicAdminOptions(members);

  const visibleOptions = filterOptions(options, query, selected);

  const handleChange = async (next: string[]) => {
    const added = next.filter((memberId) => !selected.includes(memberId));
    const removed = selected.filter((memberId) => !next.includes(memberId));
    if (added.length === 0 && removed.length === 0) return;

    setSaving(true);
    const results = await Promise.all([
      ...added.map((memberId) => onPatch(memberId, { is_clinic_admin: true })),
      ...removed.map((memberId) =>
        onPatch(memberId, { is_clinic_admin: false }),
      ),
    ]);
    setSaving(false);

    if (results.includes(false))
      toast.error('Не удалось изменить администраторов');
  };

  return (
    <div>
      <div id={id}>
        <CustomDropdown<string, true>
          multiple
          options={visibleOptions}
          value={selected}
          onChange={handleChange}
          onSearch={setQuery}
          triggerClassName={fieldFillClass(selected)}
          disabled={disabled || saving}
          placeholder={options.length ? 'Не выбраны' : 'Сотрудников пока нет'}
          aria-label="Администраторы"
          renderTrigger={() => (
            <span className="text-sm text-[#202020]">
              Выбран: {selected.length}
            </span>
          )}
        />
      </div>
      <button
        type="button"
        onClick={onInviteAdmin}
        disabled={disabled}
        className={`mt-1.5 ${LINK_BUTTON_CLASS}`}
      >
        Пригласить администратора
      </button>
    </div>
  );
};
