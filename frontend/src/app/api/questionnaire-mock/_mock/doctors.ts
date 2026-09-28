// Демонстрационная клиника и её врачи в форме ответа `GET /public/links/{slug}`.
//
// Состав подобран так, чтобы проверялись поиск по ФИО, фильтр по
// специализации, их совместное применение и пустая выдача: есть однофамильцы,
// врачи с одной и с несколькими специализациями. У врача с несколькими
// специализациями анкета начинается с вопроса о специализации.
//
// Ссылки: `/q/demo` — клиника; `/q/demo-doctor` — врач с тремя
// специализациями; `/q/demo-doctor-5` — врач с одной. Любой другой slug без
// `doctor` — тоже ссылка клиники, с `doctor` — ссылка первого врача.
//
// Фото — уже лежащий в `public/` файл `/profile.svg`: относительный путь
// того же origin. Отдельный маршрут раздачи картинок заглушке не нужен.

import type { PublicLinkDoctor, PublicSpecialization } from '@/api';

export const MOCK_DOCTOR_PHOTO = '/profile.svg';

export const MOCK_CLINIC = {
  clinic_id: '00000000-0000-4000-8000-000000000001',
  clinic_name: 'Клиника «Демо»',
  phone: '+7 900 000-00-00',
  // Относительный путь того же origin: файл уже лежит в public/.
  logo_url: '/logo.svg',
  brand_color: '#1B4B8F',
  clinic_public_slug: 'demo',
};

const SPECIALIZATIONS = {
  cardio: { id: 1, code: 'cardio', name: 'Кардиолог' },
  therapist: { id: 2, code: 'therapist', name: 'Терапевт' },
  neuro: { id: 3, code: 'neuro', name: 'Невролог' },
  surgeon: { id: 4, code: 'surgeon', name: 'Хирург' },
  ophthalmo: { id: 5, code: 'ophthalmo', name: 'Офтальмолог' },
  trauma: { id: 6, code: 'trauma', name: 'Травматолог' },
  endo: { id: 7, code: 'endo', name: 'Эндокринолог' },
} satisfies Record<string, PublicSpecialization>;

const doctor = (
  index: number,
  lastName: string,
  firstName: string,
  middleName: string | null,
  specializations: PublicSpecialization[],
  photo: boolean,
): PublicLinkDoctor => ({
  membership_id: `00000000-0000-4000-8000-00000000010${index}`,
  public_slug: index === 1 ? 'demo-doctor' : `demo-doctor-${index}`,
  photo_url: photo ? MOCK_DOCTOR_PHOTO : null,
  first_name: firstName,
  last_name: lastName,
  middle_name: middleName,
  specializations,
});

// Порядок — по фамилии, как `list_active_doctors` у backend.
export const mockDoctors: PublicLinkDoctor[] = [
  doctor(
    1,
    'Алексеев',
    'Николай',
    'Петрович',
    [SPECIALIZATIONS.cardio, SPECIALIZATIONS.therapist, SPECIALIZATIONS.neuro],
    true,
  ),
  doctor(
    8,
    'Белов',
    'Артём',
    'Игоревич',
    [SPECIALIZATIONS.neuro, SPECIALIZATIONS.therapist],
    false,
  ),
  doctor(
    5,
    'Егорова',
    'Светлана',
    'Ивановна',
    [SPECIALIZATIONS.therapist],
    false,
  ),
  doctor(
    3,
    'Константинопольская',
    'Александра',
    'Александровна',
    [SPECIALIZATIONS.ophthalmo, SPECIALIZATIONS.neuro],
    true,
  ),
  doctor(
    4,
    'Константинопольская',
    'Мария',
    'Александровна',
    [SPECIALIZATIONS.cardio],
    true,
  ),
  doctor(
    2,
    'Никитин',
    'Фёдор',
    'Николаевич',
    [SPECIALIZATIONS.cardio, SPECIALIZATIONS.surgeon],
    true,
  ),
  doctor(
    6,
    'Орлов',
    'Дмитрий',
    'Сергеевич',
    [SPECIALIZATIONS.surgeon, SPECIALIZATIONS.trauma],
    true,
  ),
  doctor(7, 'Соколова', 'Анна', 'Викторовна', [SPECIALIZATIONS.endo], true),
];

/** Врач ссылки: slug врача или первый врач для любого slug с `doctor`. */
export const doctorForSlug = (slug: string): PublicLinkDoctor | null => {
  if (!slug.includes('doctor')) return null;

  return (
    mockDoctors.find((item) => item.public_slug === slug) ?? mockDoctors[0]
  );
};

/**
 * Кто не ведёт приём в режиме `doctor_inactive`: врач ссылки `/q/demo-doctor`.
 * Как у backend, его нет среди активных врачей, а ссылка на него закрыта.
 */
export const INACTIVE_DOCTOR_ID = mockDoctors[0].membership_id;

/** Активные врачи клиники. */
export const activeDoctors = (doctorInactive: boolean): PublicLinkDoctor[] =>
  doctorInactive
    ? mockDoctors.filter((item) => item.membership_id !== INACTIVE_DOCTOR_ID)
    : mockDoctors;
