import { describe, expect, it } from 'vitest';
import { structureFieldsPayload } from './structure-payload';
import type { LocalField } from './field-model';

const field = (localId: string, label: string): LocalField => ({
  localId,
  field_name: '',
  field_label: label,
  field_type: 'text',
  default_value: null,
  default_value_jsonb: null,
  dictionary: null,
  protocol_fields_main_id: null,
  is_required: false,
  sort_order: 0,
  options: [],
});

describe('structure field identity during autosave', () => {
  it('keeps persisted ids and names when labels change and fields move', () => {
    const identities = new Map([
      ['local-a', { id: 'server-a', name: 'complaints' }],
      ['local-b', { id: 'server-b', name: 'allergy' }],
    ]);
    const result = structureFieldsPayload(
      [field('local-b', 'Новая аллергия'), field('local-a', 'Новые жалобы')],
      identities,
    );
    expect(
      result.map((f) => [f.id, f.field.field_name, f.field.sort_order]),
    ).toEqual([
      ['server-b', 'allergy', 0],
      ['server-a', 'complaints', 1],
    ]);
    expect(result[0].field.field_label).toBe('Новая аллергия');
  });

  it('assigns a deterministic name to an empty new field', () => {
    const draft = field('local-new', '');
    expect(structureFieldsPayload([draft], new Map())[0].field.field_name).toBe(
      'local_new',
    );
  });

  it('reserves persisted names before naming a newly inserted field', () => {
    const identities = new Map([
      ['existing', { id: 'server-id', name: 'zhaloby' }],
    ]);
    const result = structureFieldsPayload(
      [field('new', 'Жалобы'), field('existing', 'Жалобы')],
      identities,
    );
    expect(result.map((f) => [f.id, f.field.field_name])).toEqual([
      [undefined, 'zhaloby_2'],
      ['server-id', 'zhaloby'],
    ]);
  });

  it('sends selectable options with their defaults intact', () => {
    const draft = {
      ...field('local-options', 'Выбор'),
      field_type: 'checkbox',
      options: [
        { localId: 'o1', text: 'Первый', isDefault: true },
        { localId: 'o2', text: 'Второй', isDefault: false },
      ],
    };
    expect(
      structureFieldsPayload([draft], new Map())[0].field.default_value_jsonb,
    ).toEqual({ options: ['Первый', 'Второй'], defaults: ['Первый'] });
  });
});
