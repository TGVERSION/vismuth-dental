import { describe, expect, it } from 'vitest';
import { readGastroHistory, readPatientQuestions } from './gastro-history';

describe('gastro doctor history', () => {
  it('keeps the source narrative intact even when it is long', () => {
    const raw = 'Исходный рассказ\n'.repeat(1000);
    expect(readGastroHistory({raw:{history_narrative:raw},chronology:null}).raw)
      .toEqual([{label:'Рассказ пациента',value:raw}]);
  });
  it('does not invent a timeline from free text', () => {
    expect(readGastroHistory({raw:{history_narrative:'Даты не помню'}}).chronology).toEqual([]);
  });
  it('keeps verified chronology and original sections separate', () => {
    const result = readGastroHistory({raw:{history_treatments:'Раньше принимал препарат'},
      chronology:[{label:'Лечение',value:'Период не указан'}]});
    expect(result.chronology).toEqual([{label:'Лечение',value:'Период не указан'}]);
    expect(result.raw[0].value).toBe('Раньше принимал препарат');
  });
  it('reads server chronology facts without inventing dates', () => {
    expect(readGastroHistory({chronology:[{label:'Обследования',text:'ФГДС',period:'Дату не помню',date:null,source:'patient'}]}).chronology)
      .toEqual([{label:'Обследования',value:'Дату не помню\nФГДС'}]);
  });
  it('preserves patient question wording and order without adding system questions', () => {
    expect(readPatientQuestions(['  Что дальше?  ','Когда повторить анализ?',null]))
      .toEqual(['  Что дальше?  ','Когда повторить анализ?']);
    expect(readPatientQuestions(undefined)).toEqual([]);
  });
});
