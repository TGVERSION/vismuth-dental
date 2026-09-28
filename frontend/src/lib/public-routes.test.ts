import { describe, expect, it } from 'vitest';
import { isPublicPath } from './public-routes';

describe('isPublicPath', () => {
  it('пропускает маршруты с фиксированным адресом', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/register')).toBe(true);
    expect(isPublicPath('/verify')).toBe(true);
  });

  it('пропускает анкету пациента с любым кодом ссылки', () => {
    expect(isPublicPath('/q')).toBe(true);
    expect(isPublicPath('/q/abc')).toBe(true);
    expect(isPublicPath('/q/AbC123')).toBe(true);
    expect(isPublicPath('/q/abc/')).toBe(true);
  });

  it('не открывает маршруты, совпадающие с префиксом только по буквам', () => {
    // Главный случай, ради которого сравнение идёт по сегменту: голый
    // startsWith('/q') открыл бы эти пути наружу.
    expect(isPublicPath('/quotes')).toBe(false);
    expect(isPublicPath('/qa')).toBe(false);
    expect(isPublicPath('/qq/abc')).toBe(false);
  });

  it('не открывает страницу анкет врача', () => {
    // Путь совпадает с публичным префиксом анкеты пациента `/q` по буквам.
    // Наружу его не пускает только сравнение по сегменту — а на этой
    // странице имена пациентов.
    expect(isPublicPath('/questionnaires')).toBe(false);
    expect(isPublicPath('/questionnaires/abc')).toBe(false);
  });

  it('пропускает страницу принятия приглашения', () => {
    expect(isPublicPath('/invite/accept')).toBe(true);
    expect(isPublicPath('/invite')).toBe(true);
  });

  it('не открывает пути, совпадающие с /invite только по буквам', () => {
    expect(isPublicPath('/invites')).toBe(false);
    expect(isPublicPath('/invitex/accept')).toBe(false);
  });

  it('не открывает защищённую зону', () => {
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/protocol')).toBe(false);
    expect(isPublicPath('/login/extra')).toBe(false);
  });
});
