import { describe, expect, it } from 'vitest';
import type { MyClinicRead } from '@/api';
import {
  isLocalOnlyUrl,
  qrFileName,
  questionnaireLinks,
} from './questionnaire-links';

const makeClinic = (patch: Partial<MyClinicRead> = {}): MyClinicRead => ({
  clinic_id: 'clinic-1',
  clinic_name: 'Клиника «Демо»',
  clinic_public_slug: 'demo1234',
  clinic_public_url: 'https://vismuth.example.ru/q/demo1234',
  membership_id: 'membership-1',
  is_clinic_admin: false,
  is_doctor: true,
  doctor_public_slug: 'doc5678',
  doctor_public_url: 'https://vismuth.example.ru/q/doc5678',
  specializations: [],
  ...patch,
});

describe('questionnaireLinks', () => {
  it('врач — две ссылки: сначала своя, затем клиники', () => {
    const links = questionnaireLinks(makeClinic());

    expect(links.map((link) => link.kind)).toEqual(['doctor', 'clinic']);
    expect(links[0]).toMatchObject({
      title: 'Ваша ссылка',
      url: 'https://vismuth.example.ru/q/doc5678',
      qrText: 'https://vismuth.example.ru/q/doc5678',
      fileName: 'vismuth-qr-doctor-doc5678.png',
    });
    expect(links[1]).toMatchObject({
      title: 'Ссылка клиники',
      url: 'https://vismuth.example.ru/q/demo1234',
      fileName: 'vismuth-qr-clinic-demo1234.png',
    });
    expect(links[1].description).toContain('Клиника «Демо»');
  });

  it('администратор без флага «врач» — только ссылка клиники', () => {
    const links = questionnaireLinks(
      makeClinic({
        is_doctor: false,
        is_clinic_admin: true,
        doctor_public_slug: null,
        doctor_public_url: null,
      }),
    );

    expect(links.map((link) => link.kind)).toEqual(['clinic']);
  });

  it('врач без адреса ссылки — только ссылка клиники', () => {
    const links = questionnaireLinks(makeClinic({ doctor_public_url: null }));

    expect(links.map((link) => link.kind)).toEqual(['clinic']);
  });

  it('адрес не http(s) — показывается, но без QR', () => {
    const [clinic] = questionnaireLinks(
      makeClinic({ is_doctor: false, clinic_public_url: 'ftp://host/q/x' }),
    );

    expect(clinic.url).toBe('ftp://host/q/x');
    expect(clinic.qrText).toBeNull();
  });
});

describe('qrFileName', () => {
  it('только латиница, цифры и дефис', () => {
    expect(qrFileName('clinic', 'Demo_Клиника 1')).toBe(
      'vismuth-qr-clinic-demo-1.png',
    );
  });

  it('пустой slug — запасное имя', () => {
    expect(qrFileName('doctor', null)).toBe('vismuth-qr-doctor-link.png');
    expect(qrFileName('doctor', '___')).toBe('vismuth-qr-doctor-link.png');
  });
});

describe('isLocalOnlyUrl', () => {
  it('локальная ссылка на публичной странице — предупреждение', () => {
    expect(
      isLocalOnlyUrl('http://localhost:3000/q/abcd', 'vismuth.example.ru'),
    ).toBe(true);
    expect(
      isLocalOnlyUrl('http://127.0.0.1/q/abcd', 'vismuth.example.ru'),
    ).toBe(true);
  });

  it('страница тоже локальная (разработка) — без предупреждения', () => {
    expect(isLocalOnlyUrl('http://localhost:3000/q/abcd', 'localhost')).toBe(
      false,
    );
  });

  it('публичная ссылка и не адрес — без предупреждения', () => {
    expect(
      isLocalOnlyUrl('https://vismuth.example.ru/q/abcd', 'vismuth.example.ru'),
    ).toBe(false);
    expect(isLocalOnlyUrl('не адрес', 'vismuth.example.ru')).toBe(false);
  });
});
