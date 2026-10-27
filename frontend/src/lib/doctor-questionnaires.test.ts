import { describe, expect, it } from 'vitest';
import {
  buildListQuery,
  buildSections,
  doctorDateRange,
  formatAppointmentTime,
  gapQuestions,
  isAppointmentPast,
  isQuestionnaireReady,
  isVisibleInList,
  notReadyMessage,
  parseGaps,
  parseSearchQuery,
  patientName,
  sortByTime,
  visitTypeLabel,
} from './doctor-questionnaires';

describe('parseSearchQuery', () => {
  it('четыре цифры — код, пробелы по краям срезаются', () => {
    expect(parseSearchQuery('1234')).toEqual({ code: '1234' });
    expect(parseSearchQuery(' 1234 ')).toEqual({ code: '1234' });
  });

  it('другая длина или не только цифры — имя', () => {
    expect(parseSearchQuery('12345')).toEqual({ name: '12345' });
    expect(parseSearchQuery('123')).toEqual({ name: '123' });
    expect(parseSearchQuery('12a4')).toEqual({ name: '12a4' });
  });

  it('из имени берётся первое слово', () => {
    expect(parseSearchQuery('Анна Петровна')).toEqual({ name: 'Анна' });
    expect(parseSearchQuery('  Пётр   Иванович ')).toEqual({ name: 'Пётр' });
  });

  it('пустой ввод — без фильтра', () => {
    expect(parseSearchQuery('')).toEqual({});
    expect(parseSearchQuery('   ')).toEqual({});
  });
});

describe('buildListQuery', () => {
  const date = '2026-09-28';

  it('дата уходит всегда, даже без поиска и типа', () => {
    expect(buildListQuery({ search: '', date, visitType: '' })).toEqual({
      date,
    });
  });

  it('код и имя — разными параметрами вместе с датой', () => {
    expect(buildListQuery({ search: '5860', date, visitType: '' })).toEqual({
      date,
      code: '5860',
    });
    expect(buildListQuery({ search: 'Анна', date, visitType: '' })).toEqual({
      date,
      name: 'Анна',
    });
  });

  it('тип приёма — только если выбран', () => {
    expect(buildListQuery({ search: '', date, visitType: 'repeat' })).toEqual({
      date,
      visit_type: 'repeat',
    });
  });
});

describe('isVisibleInList', () => {
  it('без статуса от сервера анкета видна — отличить нечего', () => {
    expect(isVisibleInList({})).toBe(true);
  });

  it('видна только обработанная', () => {
    expect(isVisibleInList({ processing_status: 'done' })).toBe(true);
    expect(isVisibleInList({ processing_status: 'pending' })).toBe(false);
    expect(isVisibleInList({ processing_status: 'failed' })).toBe(false);
    expect(isVisibleInList({ processing_status: null })).toBe(false);
  });
});

describe('isQuestionnaireReady', () => {
  it('готова, только если обработана и есть результат', () => {
    expect(
      isQuestionnaireReady({ processing_status: 'done', structured: {} }),
    ).toBe(true);
    expect(
      isQuestionnaireReady({ processing_status: 'done', structured: null }),
    ).toBe(false);
    expect(
      isQuestionnaireReady({ processing_status: 'pending', structured: {} }),
    ).toBe(false);
    expect(
      isQuestionnaireReady({ processing_status: null, structured: null }),
    ).toBe(false);
  });
});

describe('notReadyMessage', () => {
  it('различает обработку в процессе и прочее', () => {
    expect(notReadyMessage('pending')).toMatch(/обрабатывается/);
    expect(notReadyMessage('failed')).toBe('Анкета не обработана.');
    expect(notReadyMessage(null)).toBe('Анкета не обработана.');
  });
});

describe('doctorDateRange', () => {
  it('45 дней назад и 30 вперёд, через границы месяцев', () => {
    expect(doctorDateRange(new Date(2026, 8, 28))).toEqual({
      min: '2026-08-14',
      max: '2026-10-28',
    });
  });
});

describe('formatAppointmentTime', () => {
  it('приводит время к ЧЧ:ММ', () => {
    expect(formatAppointmentTime('09:00')).toBe('09:00');
    expect(formatAppointmentTime('9:30')).toBe('09:30');
    expect(formatAppointmentTime('10:30:00')).toBe('10:30');
  });

  it('без времени — прочерк', () => {
    expect(formatAppointmentTime(null)).toBe('—');
    expect(formatAppointmentTime('')).toBe('—');
    expect(formatAppointmentTime('утро')).toBe('—');
  });
});

describe('sortByTime', () => {
  it('по времени, без времени — в конце, исходный массив не меняется', () => {
    const items = [
      { id: 'c', appointment_time: '11:00' },
      { id: 'n', appointment_time: null },
      { id: 'a', appointment_time: '9:00' },
      { id: 'b', appointment_time: '10:30' },
    ];

    expect(sortByTime(items).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'n',
    ]);
    expect(items[0].id).toBe('c');
  });

  it('одинаковое время сохраняет порядок', () => {
    const items = [
      { id: 'first', appointment_time: '10:00' },
      { id: 'second', appointment_time: '10:00' },
    ];
    expect(sortByTime(items).map((item) => item.id)).toEqual([
      'first',
      'second',
    ]);
  });
});

describe('isAppointmentPast', () => {
  const item = { appointment_date: '2026-09-28', appointment_time: '10:00' };

  it('минута до приёма — ещё впереди', () => {
    expect(isAppointmentPast(item, new Date(2026, 8, 28, 9, 59))).toBe(false);
    expect(isAppointmentPast(item, new Date(2026, 8, 28, 9, 59, 59))).toBe(
      false,
    );
  });

  it('ровно в минуту приёма и позже — прошёл', () => {
    expect(isAppointmentPast(item, new Date(2026, 8, 28, 10, 0))).toBe(true);
    expect(isAppointmentPast(item, new Date(2026, 8, 28, 10, 1))).toBe(true);
  });

  it('учитывает день', () => {
    expect(isAppointmentPast(item, new Date(2026, 8, 27, 23, 0))).toBe(false);
    expect(isAppointmentPast(item, new Date(2026, 8, 29, 8, 0))).toBe(true);
  });

  it('без даты или времени — не приглушается', () => {
    const now = new Date(2026, 8, 29);
    expect(
      isAppointmentPast(
        { appointment_date: null, appointment_time: '10:00' },
        now,
      ),
    ).toBe(false);
    expect(
      isAppointmentPast(
        { appointment_date: '2026-09-28', appointment_time: null },
        now,
      ),
    ).toBe(false);
  });
});

describe('visitTypeLabel', () => {
  it('подписывает известные типы', () => {
    expect(visitTypeLabel('primary')).toBe('Первичный');
    expect(visitTypeLabel('repeat')).toBe('Повторный');
  });

  it('неизвестное значение — null', () => {
    expect(visitTypeLabel(null)).toBeNull();
    expect(visitTypeLabel('other')).toBeNull();
  });
});

describe('patientName', () => {
  it('склеивает имя и отчество, пропуская пустое', () => {
    expect(
      patientName({
        patient_first_name: 'Анна',
        patient_middle_name: 'Петровна',
      }),
    ).toBe('Анна Петровна');
    expect(
      patientName({ patient_first_name: 'Пётр', patient_middle_name: null }),
    ).toBe('Пётр');
    expect(
      patientName({ patient_first_name: ' ', patient_middle_name: null }),
    ).toBe('');
  });
});

describe('parseGaps', () => {
  it('пустое и отсутствующее — пустые списки', () => {
    const empty = {
      complaints: [],
      life_anamnesis: [],
      allergy_anamnesis: [],
      medications: [],
    };
    expect(parseGaps(null)).toEqual(empty);
    expect(parseGaps(undefined)).toEqual(empty);
    expect(parseGaps([])).toEqual(empty);
  });

  it('берёт только элементы с известным разделом и непустым вопросом', () => {
    const result = parseGaps([
      { section: 'complaints', question: ' Как давно это началось? ' },
      { section: 'medications', question: 'Сколько раз в день?' },
      { section: 'unknown', question: 'Лишний раздел' },
      { section: 'complaints', question: '   ' },
      { section: 'complaints' },
      'Вопрос без раздела',
      null,
      42,
    ]);

    expect(result).toEqual({
      complaints: ['Как давно это началось?'],
      life_anamnesis: [],
      allergy_anamnesis: [],
      medications: ['Сколько раз в день?'],
    });
  });
});

describe('buildSections', () => {
  it('четыре раздела в порядке макета, пустой помечается', () => {
    const sections = buildSections({
      structured: {
        complaints: ' Боль в пояснице ',
        life_anamnesis: 'Гипертоническая болезнь',
        allergy_anamnesis: '   ',
      },
      gaps: [
        { section: 'complaints', question: 'Где именно болит?' },
        { section: 'life_anamnesis', question: 'С какого года?' },
      ],
    });

    expect(sections.map((section) => section.key)).toEqual([
      'complaints',
      'life_anamnesis',
      'allergy_anamnesis',
      'medications',
    ]);
    expect(sections[0]).toMatchObject({
      title: 'Жалобы',
      text: 'Боль в пояснице',
      isEmpty: false,
      gaps: ['Где именно болит?'],
    });
    expect(sections[1]).toMatchObject({
      title: 'Анамнез жизни',
      text: 'Гипертоническая болезнь',
      isEmpty: false,
      gaps: ['С какого года?'],
    });
    expect(sections[2]).toMatchObject({ text: '', isEmpty: true, gaps: [] });
    expect(sections[3]).toMatchObject({ text: '', isEmpty: true });
  });

  it('без результата обработки все разделы пустые', () => {
    const sections = buildSections({ structured: null, gaps: null });
    expect(sections.every((section) => section.isEmpty)).toBe(true);
  });
});

describe('стоматологическая анкета у врача', () => {
  it('имя пациента с фамилией, если она есть', () => {
    expect(
      patientName({
        patient_last_name: 'Белова',
        patient_first_name: 'Ольга',
        patient_middle_name: 'Сергеевна',
      }),
    ).toBe('Белова Ольга Сергеевна');
  });

  it('все вопросы «Что доспросить» одним списком', () => {
    expect(
      gapQuestions([
        { section: 'complaints', question: 'Как давно болит' },
        { section: 'medications', question: 'По какому поводу назначен Эликвис' },
        { section: 'unknown', question: 'Чужой раздел' },
        'строка без раздела',
      ]),
    ).toEqual(['Как давно болит', 'По какому поводу назначен Эликвис']);
  });
});
