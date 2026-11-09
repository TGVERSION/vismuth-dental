export const operatorOnly = (
  clinic: {
    is_operator?: boolean;
    is_doctor: boolean;
    is_clinic_admin: boolean;
  } | null,
) => !!clinic?.is_operator && !clinic.is_doctor && !clinic.is_clinic_admin;
export const nonClinicalStaff = (
  clinic: {
    is_operator?: boolean;
    is_doctor: boolean;
    is_clinic_admin: boolean;
  } | null,
) =>
  !!clinic &&
  !clinic.is_doctor &&
  (!!clinic.is_operator || clinic.is_clinic_admin);
export const joinStatusLabel = (status: string) =>
  ({
    pending: 'Ожидает подтверждения',
    approved: 'Подтверждена',
    rejected: 'Отклонена',
  })[status] ?? status;
export type CompletedFilters = {
  clinic_id: string;
  kind: string;
  name: string;
  date: string;
};
export const completedQuery = (
  { date, ...filters }: CompletedFilters,
  page: number,
) => ({
  ...Object.fromEntries(
    Object.entries(filters)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v),
  ),
  ...(date ? { date_from: date, date_to: date } : {}),
  page,
  page_size: 25,
});
