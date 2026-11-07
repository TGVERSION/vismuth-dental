import {
  isGastroFieldVisible,
  type GastroField,
  type GastroValues,
} from './gastro-questionnaire';

export function gastroChatNextField(
  fields: GastroField[],
  values: GastroValues,
  after: string,
) {
  return (
    fields
      .slice(fields.findIndex((field) => field.key === after) + 1)
      .find((field) => isGastroFieldVisible(field, values)) ?? null
  );
}

export function gastroChatReply(
  field: GastroField,
  value: string | string[] | undefined,
): string {
  const parts = Array.isArray(value) ? value : [value ?? ''];
  const meaningful = parts.filter((part) => part.trim());
  if (!meaningful.length) return 'Пропущено';
  return meaningful
    .map(
      (part) =>
        field.options?.find((option) => option.value === part)?.label ?? part,
    )
    .join('\n');
}
