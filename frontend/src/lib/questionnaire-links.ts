// Ссылки анкеты пациента для окна «Ссылки и QR-код» у врача: что показать
// по ответу `GET /me/clinic`.
//
// Адрес собирает backend из FRONTEND_PUBLIC_URL. Не заданный на контуре, он
// остаётся `http://localhost:3000` — такую ссылку пациент с телефона не
// откроет, а распечатанный QR уже не исправить. Отсюда `isLocalOnlyUrl`.

import type { MyClinicRead } from '@/api';
import { normalizeQrUrl } from './qr';

export type QuestionnaireLinkKind = 'doctor' | 'clinic';

export interface QuestionnaireLinkItem {
  kind: QuestionnaireLinkKind;
  title: string;
  description: string;
  /** Адрес, как его отдал backend: показывается и копируется. */
  url: string;
  /** Что кодируется в QR. `null` — адрес не http(s), QR не строится. */
  qrText: string | null;
  /** Имя PNG при скачивании. */
  fileName: string;
}

/** Slug в имени файла — только латиница, цифры и дефис. */
const fileSlug = (slug: string | null): string =>
  (slug ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'link';

export const qrFileName = (
  kind: QuestionnaireLinkKind,
  slug: string | null,
): string => `vismuth-qr-${kind}-${fileSlug(slug)}.png`;

/**
 * Ссылки в порядке показа: сначала своя ссылка врача — ею он пользуется
 * чаще, — затем ссылка клиники. Ссылки врача нет у администратора клиники
 * без флага «врач».
 */
export const questionnaireLinks = (
  data: MyClinicRead,
): QuestionnaireLinkItem[] => {
  const items: QuestionnaireLinkItem[] = [];

  if (data.is_doctor && data.doctor_public_url) {
    items.push({
      kind: 'doctor',
      title: 'Ваша ссылка',
      description: 'Пациент сразу попадает к вам',
      url: data.doctor_public_url,
      qrText: normalizeQrUrl(data.doctor_public_url),
      fileName: qrFileName('doctor', data.doctor_public_slug),
    });
  }

  items.push({
    kind: 'clinic',
    title: 'Ссылка клиники',
    description: `${data.clinic_name} — пациент сам выберет врача`,
    url: data.clinic_public_url,
    qrText: normalizeQrUrl(data.clinic_public_url),
    fileName: qrFileName('clinic', data.clinic_public_slug),
  });

  return items;
};

const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
]);

/**
 * Ссылка ведёт на локальный адрес, а страница открыта не локально: значит,
 * на контуре не задан публичный адрес сервиса. В разработке, где страница
 * сама на localhost, предупреждение не нужно.
 */
export const isLocalOnlyUrl = (url: string, currentHost: string): boolean => {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }

  return LOCAL_HOSTS.has(host) && !LOCAL_HOSTS.has(currentHost);
};
