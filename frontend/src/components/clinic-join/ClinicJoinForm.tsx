'use client';
import type { MembershipRole } from '@/api/user-membership-api';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { clinicJoinApi, type JoinPreview } from '@/api/clinic-join-api';
import { mainApi, type TokenResponse } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { PASSWORD_MIN_LENGTH } from '@/lib/clinics';
import { CustomDropdown } from '@/components/CustomDropdown';
import { Checkbox } from '@/components/Checkbox';
const input = 'vismuth-input mt-1 w-full';
const registrationSpecializationCodes = new Set(['gastroenterologist', 'dentist']);
export function ClinicJoinForm({ token }: { token: string }) {
  const router = useRouter();
  const auth = useAuthStore();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'register' | 'login' | 'confirm'>(
    'register',
  );
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<MembershipRole>('operator');
  const [specializations, setSpecializations] = useState<number[]>([]);
  const [fields, setFields] = useState({
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    code: '',
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    clinicJoinApi
      .preview(token)
      .then((p) => {
        if (current) {
          setPreview({
            ...p,
            specializations: p.specializations.filter((specialization) =>
              specialization.code !== null &&
              registrationSpecializationCodes.has(specialization.code),
            ),
          });
          setError('');
          setRole(p.roles[0]?.value ?? 'operator');
          setSpecializations([]);
        }
      })
      .catch(() => {
        if (current)
          setError(
            'Ссылка недоступна. Попросите супер-администратора проверить подключение клиники.',
          );
      });
    return () => {
      current = false;
    };
  }, [token, retry]);
  const session = async (response: TokenResponse) => {
    auth.setAccessToken(response.access_token);
    const me = await mainApi.serviceUsers.serviceUser();
    auth.login({ ...me, id: response.user.id }, response.access_token);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !preview) return;
    setBusy(true);
    setError('');
    const selection = {
      token,
      requested_role: role,
      specialization_ids:
        role === 'doctor' || role === 'clinic_admin_doctor'
          ? specializations
          : [],
    };
    try {
      if (mode === 'confirm') {
        await session(await clinicJoinApi.confirm(fields.login, fields.code));
        router.replace('/');
        return;
      }
      if (auth.isAuthenticated) {
        await clinicJoinApi.submit(selection);
        router.replace('/');
        return;
      }
      if (mode === 'login') {
        await session(
          await mainApi.serviceUsers.login({
            login: fields.login,
            password: fields.password,
          }),
        );
        await clinicJoinApi.submit(selection);
        router.replace('/');
        return;
      }
      await clinicJoinApi.register({
        ...selection,
        login: fields.login,
        password: fields.password,
        first_name: fields.first_name,
        last_name: fields.last_name,
        middle_name: fields.middle_name || undefined,
      });
      setFields((f) => ({ ...f, password: '' }));
      setMode('confirm');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось отправить заявку',
      );
    } finally {
      setBusy(false);
    }
  };
  const field = (
    key: keyof typeof fields,
    label: string,
    type = 'text',
    required = true,
  ) => (
    <label className="block text-sm">
      {label}
      <input
        className={input}
        type={type}
        autoComplete={
          key === 'password'
            ? mode === 'login'
              ? 'current-password'
              : 'new-password'
            : key === 'login'
              ? 'email'
              : undefined
        }
        required={required}
        minLength={
          key === 'password' && mode === 'register'
            ? PASSWORD_MIN_LENGTH
            : undefined
        }
        maxLength={key === 'password' ? 128 : 255}
        value={fields[key]}
        onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ui-color-slate-100)] p-4">
      <section className="w-full max-w-lg space-y-6 rounded-2xl bg-white p-8">
        <h1 className="text-2xl font-medium">Подключение к клинике</h1>
        {preview ? (
          <>
            <p className="text-xl text-[var(--ui-color-blue-600)]">
              {preview.clinic_name}
            </p>
            <p className="text-sm text-gray-500">
              Доступ выдаёт супер-администратор после рассмотрения заявки.
            </p>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'confirm' ? (
                <>
                  <p>Код подтверждения отправлен на {fields.login}</p>
                  {field('code', 'Код из письма')}
                </>
              ) : (
                <>
                  {auth.isAuthenticated ? (
                    <p>Заявка от {auth.user?.login}</p>
                  ) : (
                    <>
                      {field('login', 'Электронная почта', 'email')}
                      {field('password', 'Пароль', 'password')}
                      {mode === 'register' && (
                        <>
                          {field('last_name', 'Фамилия')}
                          {field('first_name', 'Имя')}
                          {field('middle_name', 'Отчество', 'text', false)}
                        </>
                      )}
                    </>
                  )}
                  <label className="block text-sm">
                    Роль
                    <CustomDropdown
                      aria-label="Роль"
                      className="mt-1"
                      options={preview.roles}
                      value={role}
                      onChange={(value) => {
                        setRole(value);
                        setSpecializations([]);
                      }}
                    />
                  </label>
                  {(role === 'doctor' || role === 'clinic_admin_doctor') && (
                    <fieldset>
                      <legend className="mb-2 text-sm">
                        Специализации врача
                      </legend>
                      {preview.specializations.map((s) => (
                        <div key={s.id} className="py-1 text-sm">
                          <Checkbox
                            id={`join-specialization-${s.id}`}
                            checked={specializations.includes(s.id)}
                            disabled={busy}
                            onChange={(checked) =>
                              setSpecializations((v) =>
                                checked
                                  ? [...v, s.id]
                                  : v.filter((id) => id !== s.id),
                              )
                            }
                          >
                            {s.name}
                          </Checkbox>
                        </div>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                disabled={
                  busy ||
                  (mode !== 'confirm' &&
                    (role === 'doctor' || role === 'clinic_admin_doctor') &&
                    !specializations.length)
                }
                className="vismuth-button vismuth-button--primary w-full"
              >
                {busy
                  ? 'Отправляется…'
                  : mode === 'confirm'
                    ? 'Подтвердить почту'
                    : auth.isAuthenticated || mode === 'login'
                      ? 'Отправить заявку'
                      : 'Зарегистрироваться'}
              </button>
            </form>
            {mode === 'confirm' && (
              <button
                disabled={busy}
                className="vismuth-function-button text-sm"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Исправить данные и отправить код заново
              </button>
            )}
            {!auth.isAuthenticated && mode !== 'confirm' && (
              <button
                className="vismuth-function-button text-sm"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'register'
                  ? 'Уже есть аккаунт — войти'
                  : 'Создать новый аккаунт'}
              </button>
            )}
          </>
        ) : error ? (
          <>
            <p role="alert">{error}</p>
            <button
              onClick={() => setRetry((v) => v + 1)}
              className="vismuth-function-button"
            >
              Повторить
            </button>
          </>
        ) : (
          <p role="status">Загрузка клиники…</p>
        )}
      </section>
    </main>
  );
}
