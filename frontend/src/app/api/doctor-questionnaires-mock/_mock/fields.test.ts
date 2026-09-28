import { describe, expect, it } from 'vitest';
import { buildFieldValues } from './fields';

const mains = [
  { id: 'main-complaints', field_name: 'complaints' },
  { id: 'main-allergy', field_name: 'allergy_anamnesis' },
  { id: 'main-life', field_name: 'life_anamnesis' },
  { id: 'main-medications', field_name: 'medications' },
  { id: 'main-diagnosis', field_name: 'main_diagnosis' },
];

const field = (id: string, mainId: string | null) => ({
  id,
  protocol_fields_main_id: mainId,
});

const structured = {
  complaints: 'Боль в спине',
  allergy_anamnesis: 'Пенициллин',
  life_anamnesis: 'Гипертония',
  medications: 'Омепразол',
};

describe('buildFieldValues', () => {
  it('раскладывает разделы по полям структуры через код справочника', () => {
    expect(
      buildFieldValues(
        structured,
        [
          field('f-complaints', 'main-complaints'),
          field('f-allergy', 'main-allergy'),
          field('f-life', 'main-life'),
          field('f-medications', 'main-medications'),
          field('f-diagnosis', 'main-diagnosis'),
          field('f-custom', null),
        ],
        mains,
      ),
    ).toEqual({
      'f-complaints': 'Боль в спине',
      'f-allergy': 'Пенициллин',
      'f-life': 'Гипертония',
      'f-medications': 'Омепразол',
    });
  });

  it('без поля препаратов дописывает их в жалобы', () => {
    expect(
      buildFieldValues(
        structured,
        [field('f-complaints', 'main-complaints')],
        mains,
      ),
    ).toEqual({ 'f-complaints': 'Боль в спине\nПрепараты: Омепразол' });

    expect(
      buildFieldValues(
        { medications: 'Омепразол' },
        [field('f-complaints', 'main-complaints')],
        mains,
      ),
    ).toEqual({ 'f-complaints': 'Препараты: Омепразол' });
  });

  it('пустые разделы и анкету без результата не передаёт', () => {
    expect(
      buildFieldValues(
        { complaints: '', allergy_anamnesis: null },
        [
          field('f-complaints', 'main-complaints'),
          field('f-allergy', 'main-allergy'),
        ],
        mains,
      ),
    ).toEqual({});

    expect(
      buildFieldValues(null, [field('f-complaints', 'main-complaints')], mains),
    ).toEqual({});
  });
});
