import type { StructureProtocolsFieldsSmall } from '@/api';
import {
  isOptionsType,
  serializeOptions,
  slugify,
  type LocalField,
} from './field-model';

export interface SavedFieldIdentity {
  id: string;
  name: string;
}

/** Имена и серверные id не меняются при переименовании подписи или перестановке. */
export function structureFieldsPayload(
  fields: LocalField[],
  identities: Map<string, SavedFieldIdentity>,
): { localId: string; id?: string; field: StructureProtocolsFieldsSmall }[] {
  const usedNames = new Set([...identities.values()].map((f) => f.name));
  return fields.map((f, index) => {
    const saved = identities.get(f.localId);
    const baseName =
      saved?.name ||
      f.field_name ||
      (f.field_label.trim()
        ? slugify(f.field_label)
        : f.localId.replace(/[^a-z0-9_]/gi, '_'));
    let name = baseName;
    for (let suffix = 2; !saved && usedNames.has(name); suffix++)
      name = `${baseName}_${suffix}`;
    usedNames.add(name);
    return {
      localId: f.localId,
      id: saved?.id,
      field: {
        field_name: name,
        field_label: f.field_label || null,
        field_type: f.field_type,
        default_value: isOptionsType(f.field_type) ? null : f.default_value,
        default_value_jsonb: isOptionsType(f.field_type)
          ? serializeOptions(f.options, f.field_type)
          : null,
        dictionary: f.dictionary || null,
        protocol_fields_main_id: f.protocol_fields_main_id || null,
        is_required: f.is_required,
        sort_order: index,
      },
    };
  });
}
