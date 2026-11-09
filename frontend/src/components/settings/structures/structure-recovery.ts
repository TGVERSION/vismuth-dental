import type {
  ProtocolStructuresFields,
  StructureProtocolsFieldsSmall,
} from '@/api';

export interface StructureWriteExpectation {
  id?: string;
  creator_id: string;
  structure_code: string;
  structure_name: string;
  version: number;
  description: string | null;
  is_active: boolean;
  fields: (StructureProtocolsFieldsSmall & { id?: string })[];
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

const fieldValues = (field: StructureProtocolsFieldsSmall) => ({
  field_name: field.field_name,
  field_label: field.field_label ?? null,
  description: field.description ?? null,
  field_type: field.field_type,
  default_value: field.default_value ?? null,
  default_value_jsonb: field.default_value_jsonb ?? null,
  dictionary: field.dictionary ?? null,
  protocol_fields_main_id: field.protocol_fields_main_id ?? null,
  is_required: field.is_required ?? false,
  sort_order: field.sort_order ?? 0,
});

/** Только точное подтверждение своей операции; совпадения названия недостаточно. */
export function matchesStructureWrite(
  record: ProtocolStructuresFields,
  expected: StructureWriteExpectation,
): boolean {
  if (
    (expected.id && record.id !== expected.id) ||
    record.creator_id !== expected.creator_id ||
    record.structure_code !== expected.structure_code ||
    record.structure_name !== expected.structure_name ||
    record.version !== expected.version ||
    record.description !== expected.description ||
    record.is_active !== expected.is_active ||
    record.deleted_at !== null ||
    record.fields.length !== expected.fields.length
  )
    return false;
  const byName = new Map(record.fields.map((f) => [f.field_name, f]));
  if (byName.size !== record.fields.length) return false;
  return expected.fields.every((field) => {
    const saved = byName.get(field.field_name);
    return (
      !!saved?.id &&
      saved.protocol_structure_id === record.id &&
      (!field.id || saved.id === field.id) &&
      canonical(fieldValues(saved)) === canonical(fieldValues(field))
    );
  });
}
