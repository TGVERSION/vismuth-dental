import { NextResponse } from 'next/server';
import { toDateInputValue } from '@/lib/questionnaire';
import {
  isMockEnabled,
  notFound,
  requireAuth,
  unauthorized,
  unprocessable,
} from './_mock/guard';
import { applyMockMode, currentMockMode } from './_mock/mode';
import { seedQuestionnaires, toListItem } from './_mock/seed';

/**
 * Список анкет врача. Фильтры повторяют backend (`list_questionnaires`):
 * `code` — ровно 4 символа; с кодом и без даты — все дни, иначе дата или
 * сегодня; `name` — подстрока имени или отчества; сортировка по времени.
 *
 * Фильтра по врачу нет: заглушка отдаёт всё. Настоящий сервер фильтрует по
 * membership из токена — не принимать отсутствие фильтра за образец.
 */
export async function GET(request: Request) {
  if (!isMockEnabled) return notFound();
  if (!requireAuth(request)) return unauthorized();

  const mode = currentMockMode();
  const failure = await applyMockMode(mode);
  if (failure) return failure;

  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const date = params.get('date');
  const name = params.get('name')?.trim().toLowerCase();
  const visitType = params.get('visit_type');
  const byCompletion = params.get('by_completion') === 'true';

  if (code !== null && code.length !== 4) {
    return unprocessable('code must be exactly 4 characters');
  }

  let items = seedQuestionnaires();

  if (code) items = items.filter((item) => item.code === code);
  const day =
    date || (!byCompletion && !code ? toDateInputValue(new Date()) : null);
  if (day) items = items.filter((item) => item.appointment_date === day);

  if (visitType) items = items.filter((item) => item.visit_type === visitType);

  if (name) {
    items = items.filter((item) =>
      [
        item.patient_last_name,
        item.patient_first_name,
        item.patient_middle_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(name),
    );
  }

  items.sort((a, b) => {
    if (byCompletion)
      return (b.appointment_date ?? '').localeCompare(a.appointment_date ?? '');
    if (!a.appointment_time) return 1;
    if (!b.appointment_time) return -1;
    return a.appointment_time.localeCompare(b.appointment_time);
  });

  return NextResponse.json(
    items.map((item) => toListItem(item, mode === 'status_field')),
  );
}
