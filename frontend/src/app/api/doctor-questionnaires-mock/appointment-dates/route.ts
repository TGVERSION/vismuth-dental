import { NextResponse } from 'next/server';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
} from '../_mock/guard';
import { seedQuestionnaires } from '../_mock/seed';

export function GET(request: Request) {
  if (!isMockEnabled) return notFound();
  if (!requireAuth(request)) return unauthorized();

  const params = new URL(request.url).searchParams;
  const from = params.get('date_from');
  const to = params.get('date_to');
  const code = params.get('code');
  const name = params.get('name')?.toLowerCase();
  const days = seedQuestionnaires().flatMap((item) => {
    const day = item.appointment_date;
    if (!day || (from && day < from) || (to && day > to)) return [];
    if (code && item.code !== code) return [];
    if (
      name &&
      ![
        item.patient_last_name,
        item.patient_first_name,
        item.patient_middle_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(name)
    )
      return [];
    return [day];
  });
  return NextResponse.json([...new Set(days)].sort());
}
