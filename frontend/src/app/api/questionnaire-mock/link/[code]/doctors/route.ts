import { NextResponse } from 'next/server';
import { isMockEnabled, notFound } from '../../../_mock/guard';
import { mockDoctors, mockSpecializations } from '../../../_mock/doctors';
import type { QuestionnaireDoctorsResponse } from '@/api';

/**
 * Врачи клиники для экрана выбора. Поиск и фильтр выполняются на клиенте:
 * список врачей клиники мал, и серверный поиск только добавил бы гонки
 * запросов. Если смежники решат иначе (ВЗ-2), здесь появятся параметры.
 */
export async function GET() {
  if (!isMockEnabled) return notFound();

  const payload: QuestionnaireDoctorsResponse = {
    doctors: mockDoctors,
    specializations: mockSpecializations(),
  };

  return NextResponse.json(payload);
}
