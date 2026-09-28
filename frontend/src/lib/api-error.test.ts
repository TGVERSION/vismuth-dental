import { describe, expect, it } from 'vitest';
import { parseErrorBody } from './api-error';

describe('parseErrorBody', () => {
  it('строковый detail — сообщение без кода', () => {
    expect(parseErrorBody({ detail: 'Link not found' })).toEqual({
      message: 'Link not found',
      code: null,
    });
  });

  it('detail-объект с кодом — сообщение и код', () => {
    expect(
      parseErrorBody({
        detail: { code: 'device_limit', message: 'Вы уже заполнили анкету' },
      }),
    ).toEqual({ message: 'Вы уже заполнили анкету', code: 'device_limit' });
  });

  it('detail-объект с лишними полями — берутся только код и сообщение', () => {
    expect(
      parseErrorBody({
        detail: {
          code: 'subscription_expired',
          message: 'Сервис временно недоступен',
          phone: '+7 900 000-00-00',
        },
      }),
    ).toEqual({
      message: 'Сервис временно недоступен',
      code: 'subscription_expired',
    });
  });

  it('detail-объект без кода — код null', () => {
    expect(
      parseErrorBody({ detail: { message: 'Что-то пошло не так' } }),
    ).toEqual({ message: 'Что-то пошло не так', code: null });
  });

  it('detail-объект с нестроковыми полями — оба null', () => {
    expect(parseErrorBody({ detail: { code: 42, message: {} } })).toEqual({
      message: null,
      code: null,
    });
  });

  it('ошибка валидации 422 — сообщение из первого элемента', () => {
    expect(
      parseErrorBody({
        detail: [
          {
            loc: ['body', 'slug'],
            msg: 'String should have at least 4 characters',
          },
          { loc: ['body', 'x'], msg: 'второе' },
        ],
      }),
    ).toEqual({
      message: 'String should have at least 4 characters',
      code: null,
    });
  });

  it('пустой массив 422 — сообщение null', () => {
    expect(parseErrorBody({ detail: [] })).toEqual({
      message: null,
      code: null,
    });
  });

  it('message важнее detail', () => {
    expect(
      parseErrorBody({
        message: 'Сообщение',
        detail: { code: 'ip_limit', message: 'Попробуйте позже' },
      }),
    ).toEqual({ message: 'Сообщение', code: 'ip_limit' });
    expect(parseErrorBody({ message: 'Сообщение', detail: 'Деталь' })).toEqual({
      message: 'Сообщение',
      code: null,
    });
  });

  it('пустые строки не считаются сообщением', () => {
    expect(parseErrorBody({ message: '', detail: '' })).toEqual({
      message: null,
      code: null,
    });
  });

  it('пустое тело и не-объект — оба null', () => {
    expect(parseErrorBody(undefined)).toEqual({ message: null, code: null });
    expect(parseErrorBody(null)).toEqual({ message: null, code: null });
    expect(parseErrorBody('Internal Server Error')).toEqual({
      message: null,
      code: null,
    });
    expect(parseErrorBody([{ msg: 'x' }])).toEqual({
      message: null,
      code: null,
    });
    expect(parseErrorBody({})).toEqual({ message: null, code: null });
  });
});
