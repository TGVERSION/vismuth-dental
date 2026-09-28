'use client';

import { DateField } from '@/components/DateField';

interface ClinicDateFieldProps {
  id?: string;
  /** `YYYY-MM-DD` или пусто. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Поле даты окончания доступа клиники. Дата может быть и в прошлом (подписка
 * завершилась), поэтому диапазон — по умолчанию общего поля: от начала
 * прошлого года на десять лет вперёд.
 */
export const ClinicDateField = ({
  id,
  value,
  onChange,
  placeholder = 'До',
}: ClinicDateFieldProps) => (
  <DateField
    id={id}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
  />
);
