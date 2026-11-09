import { describe, expect, it } from 'vitest';
import type { ProtocolStructuresFields } from '@/api';
import {
  matchesStructureWrite,
  type StructureWriteExpectation,
} from './structure-recovery';

const record: ProtocolStructuresFields = {
  id: 'structure',
  creator_id: 'owner',
  structure_code: 'unique-random-code',
  structure_name: 'Имя',
  version: 2,
  description: null,
  is_active: true,
  created_at: '',
  updated_at: null,
  deleted_at: null,
  fields: [
    {
      id: 'old-field',
      protocol_structure_id: 'structure',
      field_name: 'old',
      field_label: 'Старое',
      field_type: 'text',
      description: null,
      default_value: null,
      default_value_jsonb: null,
      dictionary: null,
      protocol_fields_main_id: null,
      is_required: false,
      sort_order: 0,
    },
    {
      id: 'new-field',
      protocol_structure_id: 'structure',
      field_name: 'added',
      field_label: 'Добавлено',
      field_type: 'radio',
      description: null,
      default_value: null,
      default_value_jsonb: { default: 'Да', options: ['Да', 'Нет'] },
      dictionary: null,
      protocol_fields_main_id: null,
      is_required: false,
      sort_order: 1,
    },
  ],
};
const expected: StructureWriteExpectation = {
  ...record,
  fields: record.fields.map((f, i) => ({ ...f, id: i ? undefined : f.id })),
};

describe('confirming an ambiguous structure write', () => {
  it('accepts only the owned exact version and adopts a new field id', () => {
    expect(matchesStructureWrite(record, expected)).toBe(true);
    expect(
      matchesStructureWrite({ ...record, creator_id: 'other' }, expected),
    ).toBe(false);
    expect(matchesStructureWrite({ ...record, version: 3 }, expected)).toBe(
      false,
    );
    expect(
      matchesStructureWrite({ ...record, structure_code: 'other' }, expected),
    ).toBe(false);
  });

  it('rejects changed existing ids, missing/new extra fields and incomplete deletions', () => {
    expect(
      matchesStructureWrite(
        {
          ...record,
          fields: [
            { ...record.fields[0], id: 'replacement' },
            record.fields[1],
          ],
        },
        expected,
      ),
    ).toBe(false);
    expect(
      matchesStructureWrite(
        { ...record, fields: record.fields.slice(0, 1) },
        expected,
      ),
    ).toBe(false);
    expect(
      matchesStructureWrite(
        {
          ...record,
          fields: [
            ...record.fields,
            { ...record.fields[0], id: 'not-deleted', field_name: 'removed' },
          ],
        },
        expected,
      ),
    ).toBe(false);
  });

  it('compares JSON values independently of key order but rejects different defaults', () => {
    expect(
      matchesStructureWrite(
        {
          ...record,
          fields: [
            record.fields[0],
            {
              ...record.fields[1],
              default_value_jsonb: { options: ['Да', 'Нет'], default: 'Да' },
            },
          ],
        },
        expected,
      ),
    ).toBe(true);
    expect(
      matchesStructureWrite(
        {
          ...record,
          fields: [
            record.fields[0],
            {
              ...record.fields[1],
              default_value_jsonb: { options: ['Да', 'Нет'], default: 'Нет' },
            },
          ],
        },
        expected,
      ),
    ).toBe(false);
  });
});
