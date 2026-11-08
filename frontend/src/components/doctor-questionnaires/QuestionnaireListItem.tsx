import Link from 'next/link';
import type { DoctorQuestionnaireListItem } from '@/api';
import {
  formatAppointmentTime,
  isAppointmentPast,
  patientName,
  visitTypeLabel,
} from '@/lib/doctor-questionnaires';

interface QuestionnaireListItemProps {
  item: DoctorQuestionnaireListItem;
  selected: boolean;
  now: Date;
}

/**
 * Строка списка анкет. Ссылка, а не кнопка: анкету можно открыть в новой
 * вкладке, «назад» возвращает к предыдущей. Прошедший приём — приглушённым
 * цветом, как на макете.
 */
export const QuestionnaireListItem = ({
  item,
  selected,
  now,
}: QuestionnaireListItemProps) => {
  const isPast = isAppointmentPast(item, now);
  const name = patientName(item);
  const typeLabel = visitTypeLabel(item.visit_type);

  return (
    <Link
      href={`/questionnaires?id=${encodeURIComponent(item.id)}`}
      scroll={false}
      aria-current={selected ? 'true' : undefined}
      className={`flex items-center gap-3 rounded-[15px] px-3 py-2.5 transition-colors ${
        selected ? 'bg-white' : 'hover:bg-white'
      } ${isPast ? 'text-[#8B8B8B]' : 'text-[#202020]'}`}
    >
      <span className="w-15 shrink-0 text-[22px]">
        {formatAppointmentTime(item.appointment_time)}
      </span>
      <span className="min-w-0 text-[14px]">
        <span className="block truncate">
          {item.code && <span className="font-semibold">{item.code}</span>}
          {item.code && name && ' · '}
          {name}
        </span>
        {typeLabel && <span className="block text-[#8B8B8B]">{typeLabel}</span>}
      </span>
    </Link>
  );
};
