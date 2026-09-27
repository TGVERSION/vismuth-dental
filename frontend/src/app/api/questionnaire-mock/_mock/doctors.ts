// Демонстрационные врачи клиники. Состав подобран так, чтобы проверялись
// поиск по ФИО, фильтр по специализации, их совместное применение и пустая
// выдача: есть однофамильцы, врачи с одной и с несколькими специализациями.
//
// Фото — уже лежащий в `public/` файл `/profile.svg`: относительный путь
// того же origin, ровно то, что запрошено у смежников (ВЗ-7). Отдельный
// маршрут раздачи картинок заглушке не нужен.

import type { QuestionnaireDoctor } from '@/api';

export const MOCK_DOCTOR_PHOTO = '/profile.svg';

export const mockDoctors: QuestionnaireDoctor[] = [
  {
    id: 'doc-1',
    full_name: 'Алексеев Николай Петрович',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Кардиолог', 'Терапевт', 'Невролог'],
  },
  {
    id: 'doc-2',
    full_name: 'Никитин Фёдор Николаевич',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Кардиолог', 'Хирург'],
  },
  {
    id: 'doc-3',
    full_name: 'Константинопольская Александра Александровна',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Офтальмолог', 'Невролог'],
  },
  {
    id: 'doc-4',
    full_name: 'Константинопольская Мария Александровна',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Кардиолог'],
  },
  {
    id: 'doc-5',
    full_name: 'Егорова Светлана Ивановна',
    photo_url: null,
    specializations: ['Терапевт'],
  },
  {
    id: 'doc-6',
    full_name: 'Орлов Дмитрий Сергеевич',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Хирург', 'Травматолог'],
  },
  {
    id: 'doc-7',
    full_name: 'Соколова Анна Викторовна',
    photo_url: MOCK_DOCTOR_PHOTO,
    specializations: ['Эндокринолог'],
  },
  {
    id: 'doc-8',
    full_name: 'Белов Артём Игоревич',
    photo_url: null,
    specializations: ['Невролог', 'Терапевт'],
  },
];

export const mockSpecializations = (): string[] =>
  Array.from(
    new Set(mockDoctors.flatMap((doctor) => doctor.specializations)),
  ).sort((a, b) => a.localeCompare(b, 'ru'));
