'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MyClinicRead } from '@/api';
import { apiClient, mutationApiClient } from '@/api/main-api';
import { ClinicLogoUpload } from './ClinicLogoUpload';
import { SafeImage } from '@/components/SafeImage';
import { useClinicMembers } from '@/hooks/useClinicMembers';
import { useSpecializations } from '@/hooks/useSpecializations';
import { ClinicMembers } from './ClinicMembers';
import { InviteMemberModal } from './InviteMemberModal';
import { ModalShell } from './ModalShell';

export function OwnClinicSettings({
  clinic,
  onClose,
  onClinicalSettings,
}: {
  clinic: MyClinicRead;
  onClose: () => void;
  onClinicalSettings?: () => void;
}) {
  const staff = useClinicMembers(clinic.clinic_id);
  const { specializations } = useSpecializations();
  const [limit, setLimit] = useState<{
    doctors_count: number;
    doctors_limit: number;
  } | null>(null);
  const [invite, setInvite] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    apiClient
      .get<{
        doctors_count: number;
        doctors_limit: number;
        logo_url: string | null;
      }>('/clinics/' + clinic.clinic_id)
      .then((value) => {
        setLimit(value);
        setLogoUrl(value.logo_url);
        setError(false);
      })
      .catch(() => setError(true));
  }, [clinic.clinic_id]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const canAddDoctor = !!limit && limit.doctors_count < limit.doctors_limit;
  const state = {
    ...staff,
    patchMember: async (...args: Parameters<typeof staff.patchMember>) => {
      const ok = await staff.patchMember(...args);
      if (
        ok &&
        args[0] === clinic.membership_id &&
        ['is_doctor', 'is_clinic_admin', 'is_operator'].some(
          (key) => key in args[1],
        )
      )
        window.location.reload();
      return ok;
    },
  };
  return (
    <ModalShell title={clinic.clinic_name} onClose={onClose}>
      <div className="mb-6">
        <h3 className="text-lg font-medium">Логотип клиники</h3>
        {logoUrl && (
          <SafeImage
            src={logoUrl}
            alt="Логотип клиники"
            width={160}
            height={64}
            className="mt-2 h-16 w-auto object-contain"
          />
        )}
        <ClinicLogoUpload
          onUpload={async (file) => {
            const result = await mutationApiClient.put<{ logo_url: string }>(
              `/clinics/${clinic.clinic_id}/logo`,
              file,
              { 'Content-Type': file.type },
            );
            setLogoUrl(result.logo_url);
          }}
        />
      </div>
      {onClinicalSettings && (
        <button
          type="button"
          className="vismuth-function-button mb-6"
          onClick={onClinicalSettings}
        >
          Рабочие настройки врача
        </button>
      )}
      {error ? (
        <p role="alert">
          Не удалось загрузить настройки клиники.{' '}
          <button className="vismuth-function-button" onClick={refresh}>
            Повторить
          </button>
        </p>
      ) : (
        <>
          <ClinicMembers
            state={state}
            canAddDoctor={canAddDoctor}
            specializations={specializations}
            onAdd={() => setInvite(true)}
            onDoctorsChanged={refresh}
          />
          {invite && (
            <InviteMemberModal
              defaultRoles={canAddDoctor ? ['doctor'] : ['operator']}
              canAddDoctor={canAddDoctor}
              specializations={specializations}
              onInvite={staff.invite}
              onClose={() => setInvite(false)}
            />
          )}
        </>
      )}
    </ModalShell>
  );
}
