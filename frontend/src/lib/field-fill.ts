// Фон поля зависит от того, заполнено ли оно: пустое — светлее,
// заполненное — темнее (макеты раздела «Клиники» и приглашения).

export const FIELD_EMPTY_BG = 'bg-[#F1F1F1]';
export const FIELD_FILLED_BG = 'bg-[#E2E8F0]';

/** Заполнено ли поле: непустая строка, непустой список, выбранное значение. */
export const isFilled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return value !== null && value !== undefined;
};

export const fieldFillClass = (value: unknown): string =>
  isFilled(value) ? FIELD_FILLED_BG : FIELD_EMPTY_BG;
