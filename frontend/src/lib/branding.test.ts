import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXT_COLOR,
  NEUTRAL_BRAND_COLOR,
  brandStyle,
  pickContrastColor,
  sanitizeBrandColor,
  isExternalImageUrl,
  sanitizeImageUrl,
} from './branding';

describe('sanitizeBrandColor', () => {
  it('пропускает корректный #RRGGBB', () => {
    expect(sanitizeBrandColor('#1B4B8F')).toBe('#1B4B8F');
    expect(sanitizeBrandColor('  #1b4b8f  ')).toBe('#1B4B8F');
  });

  it('отклоняет всё, что не ровно шесть шестнадцатеричных цифр', () => {
    expect(sanitizeBrandColor('red')).toBeNull();
    expect(sanitizeBrandColor('#fff')).toBeNull();
    expect(sanitizeBrandColor('#GGGGGG')).toBeNull();
    expect(sanitizeBrandColor('rgb(0,0,0)')).toBeNull();
    expect(sanitizeBrandColor(null)).toBeNull();
    expect(sanitizeBrandColor(undefined)).toBeNull();
  });

  it('отклоняет попытку инъекции стилей', () => {
    expect(
      sanitizeBrandColor('#ffffff; background: url(http://x/a)'),
    ).toBeNull();
    expect(sanitizeBrandColor('#ffffff}html{display:none')).toBeNull();
  });
});

describe('sanitizeImageUrl', () => {
  it('пропускает относительный путь того же origin', () => {
    expect(sanitizeImageUrl('/logo.svg')).toBe('/logo.svg');
    expect(sanitizeImageUrl('  /media/clinic/1.png ')).toBe(
      '/media/clinic/1.png',
    );
  });

  it('пропускает внешний адрес по https', () => {
    expect(sanitizeImageUrl(' https://cdn.example.com/a.png ')).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('отклоняет http, протокол-относительные адреса и голое имя файла', () => {
    expect(sanitizeImageUrl('http://example.com/a.png')).toBeNull();
    expect(sanitizeImageUrl('//example.com/a.png')).toBeNull();
    expect(sanitizeImageUrl('/\\example.com/a.png')).toBeNull();
    expect(sanitizeImageUrl('logo.svg')).toBeNull();
  });

  it('отклоняет логин и пароль в адресе', () => {
    expect(sanitizeImageUrl('https://user:pass@example.com/a.png')).toBeNull();
    expect(sanitizeImageUrl('https://user@example.com/a.png')).toBeNull();
  });

  it('отклоняет опасные схемы', () => {
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeImageUrl('data:image/svg+xml,<svg/>')).toBeNull();
    expect(sanitizeImageUrl(null)).toBeNull();
  });
});

describe('pickContrastColor', () => {
  it('на тёмном фирменном цвете выбирает белый', () => {
    expect(pickContrastColor('#1B4B8F')).toBe('#FFFFFF');
    expect(pickContrastColor('#000000')).toBe('#FFFFFF');
  });

  it('на светлом фирменном цвете выбирает тёмный текст', () => {
    expect(pickContrastColor('#FFFFFF')).toBe(DEFAULT_TEXT_COLOR);
    expect(pickContrastColor('#FFE500')).toBe(DEFAULT_TEXT_COLOR);
  });

  it('на средних синих и бирюзовых выбирает белый', () => {
    // По формуле WCAG 2 здесь победил бы тёмный текст.
    expect(pickContrastColor('#008FD5')).toBe('#FFFFFF');
    expect(pickContrastColor('#4F8FCF')).toBe('#FFFFFF');
    expect(pickContrastColor('#00A3A3')).toBe('#FFFFFF');
  });

  it('на непрошедшем проверку цвете не падает', () => {
    expect(pickContrastColor('red')).toBe('#FFFFFF');
  });
});

describe('brandStyle', () => {
  it('подставляет цвет клиники и подходящий контраст', () => {
    const style = brandStyle({
      name: 'Клиника',
      phone: '+7 900 000-00-00',
      logo_url: '/logo.svg',
      brand_color: '#FFE500',
    }) as Record<string, string>;

    expect(style['--q-brand']).toBe('#FFE500');
    expect(style['--q-brand-contrast']).toBe(DEFAULT_TEXT_COLOR);
  });

  it('падает в нейтральный цвет, когда брендинга нет или он мусорный', () => {
    expect((brandStyle(null) as Record<string, string>)['--q-brand']).toBe(
      NEUTRAL_BRAND_COLOR,
    );

    const broken = brandStyle({
      name: 'Клиника',
      phone: '',
      logo_url: null,
      brand_color: '#fff; background: url(x)',
    }) as Record<string, string>;

    expect(broken['--q-brand']).toBe(NEUTRAL_BRAND_COLOR);
  });
});

describe('isExternalImageUrl', () => {
  it('отличает внешний адрес от пути того же origin', () => {
    expect(isExternalImageUrl('https://cdn.example.com/a.png')).toBe(true);
    expect(isExternalImageUrl('/logo.svg')).toBe(false);
  });
});


describe('readable clinic accent', () => {
  it('keeps near-white clinic fill but uses readable text and outlines on white', () => {
    const style = brandStyle({name:'Клиника',phone:'',logo_url:null,brand_color:'#F3F8FD'}) as Record<string,string>;
    expect(style['--q-brand']).toBe('#F3F8FD');
    expect(style['--q-accent']).toBe(NEUTRAL_BRAND_COLOR);
    expect(style['--q-brand-contrast']).toBe(DEFAULT_TEXT_COLOR);
  });
  it('retains a dark clinic accent', () => {
    expect((brandStyle({name:'Клиника',phone:'',logo_url:null,brand_color:'#1B4B8F'}) as Record<string,string>)['--q-accent']).toBe('#1B4B8F');
  });
});
