import { describe, expect, it } from 'vitest';
import {
  buildGastroAnswer,
  gastroMeta,
  isGastroFieldVisible,
  toggleGastroChoice,
  validateGastroFields,
  type GastroField,
} from './gastro-questionnaire';
import type { QuestionnaireStep } from '@/api';

const step = (fields: GastroField[], values = {}) => ({
  step_key: 'gastro_questions', step_type: 'gastro_form',
  gastro: { screen: 'questions', section: 'Вопросы врачу', revision: 7,
    can_back: true, fields, values },
}) as unknown as QuestionnaireStep;

describe('gastro questionnaire contract', () => {
  it('rejects an unsupported field instead of losing required information', () => {
    expect(gastroMeta(step([{ key: 'x', label: 'X', type: 'unknown' } as never]))).toBeNull();
  });

  it('keeps unknown distinct from a positive choice and explicit none', () => {
    const field: GastroField = { key: 'family', label: 'Семья', type: 'multi',
      options: [{value:'cancer',label:'Рак'},{value:'none',label:'Нет известных'},
        {value:'unknown',label:'Не знаю'}], exclusive_values: ['none','unknown'] };
    expect(toggleGastroChoice(field, ['unknown'], 'cancer')).toEqual(['cancer']);
    expect(toggleGastroChoice(field, ['cancer'], 'none')).toEqual(['none']);
    expect(toggleGastroChoice(field, ['none'], 'unknown')).toEqual(['unknown']);
  });

  it('omits hidden details and preserves the period of each symptom', () => {
    const fields: GastroField[] = [
      {key:'pain.since',label:'Боль',type:'single'},
      {key:'bleeding.since',label:'Кровь',type:'single'},
      {key:'allergy.detail',label:'Аллергия',type:'text',show_when:{key:'allergy',value:'yes'}},
    ];
    const answer = buildGastroAnswer(step(fields), {
      'pain.since':['years'], 'bleeding.since':['today'],
      allergy:['none'], 'allergy.detail':'old detail',
    });
    expect(answer.selections).toEqual({'pain.since':['years'],'bleeding.since':['today']});
    expect(answer.texts).toEqual({});
    expect(answer.revision).toBe(7);
  });

  it('sends optional questions verbatim and in their order, omitting blank rows', () => {
    const questionField: GastroField = {key:'patient_questions',label:'Ваши вопросы',type:'list'};
    const answer = buildGastroAnswer(step([questionField]), {
      patient_questions: ['  Что делать дальше?  ', '', 'Когда ждать результат?'],
    });
    expect(JSON.parse(answer.texts!.patient_questions)).toEqual([
      '  Что делать дальше?  ', 'Когда ждать результат?',
    ]);
    expect(buildGastroAnswer(step([questionField]), {patient_questions:[]}).texts)
      .toEqual({patient_questions:'[]'});
  });

  it('preserves a large history and reports overflow without truncating it', () => {
    const field: GastroField = {key:'history.raw',label:'История',type:'multiline',max_length:20000};
    const story = 'Лечение и обследования.\n'.repeat(600);
    expect(story.length).toBeGreaterThan(1000);
    expect(buildGastroAnswer(step([field]), {'history.raw':story}).texts!['history.raw'])
      .toBe(story);
    expect(validateGastroFields([field], {'history.raw':'я'.repeat(20001)})['history.raw'])
      .toContain('20000');
  });

  it('validates only visible required fields and keeps an empty question list valid', () => {
    const hidden: GastroField = {key:'detail',label:'Подробности',type:'text',required:true,
      show_when:{key:'status',value:'yes'}};
    expect(isGastroFieldVisible(hidden, {status:['none']})).toBe(false);
    expect(validateGastroFields([hidden], {status:['none']})).toEqual({});
    expect(validateGastroFields([{key:'questions',label:'Вопросы',type:'list'}], {})).toEqual({});
  });

  it('sends back or terminal AI actions without accidentally submitting current field data', () => {
    const current = step([{key:'detail',label:'Ответ',type:'text',required:true}]);
    expect(buildGastroAnswer(current, {detail:'черновик'}, 'finish_ai')).toEqual({
      step_key:'gastro_questions', revision:7, choice:'finish_ai',
    });
  });
  it('carries an unsent question list on back so the server can restore its draft', () => {
    const current = step([{key:'patient_questions',label:'Вопросы',type:'list'}]);
    expect(buildGastroAnswer(current, {patient_questions:['Что спросить?']}, 'back')).toEqual({
      step_key:'gastro_questions', revision:7, choice:'back', selections:{},
      texts:{patient_questions:'["Что спросить?"]'},
    });
  });
});
