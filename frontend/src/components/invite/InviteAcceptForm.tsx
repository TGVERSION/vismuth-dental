'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { mainApi, type InvitationPreview } from '@/api';
import { ApiError } from '@/api/base-client';
import { useAuth } from '@/hooks/useAuth';
import { PASSWORD_MIN_LENGTH, isValidPassword } from '@/lib/clinics';
import { logWarn } from '@/lib/logger';
import { fieldFillClass } from '@/lib/field-fill';

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; preview: InvitationPreview }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'network' };

const INPUT_CLASS =
  'w-full px-3 py-2 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all disabled:text-[#6C757D]';

const LABEL_CLASS = 'block text-sm text-[#6C757D] mb-1.25';

const LINK_CLASS =
  'text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors';

/**
 * Принятие приглашения в клинику: превью по токену из ссылки, пароль, вход.
 * Токен — одноразовый секрет: не логируется и не сохраняется.
 */
export const InviteAcceptForm = () => {
  const token = useSearchParams().get('token') ?? '';
  const { user, isAuthenticated, handleAcceptInvitation } = useAuth();

  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustLogin, setMustLogin] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    mainApi.invitations
      .preview(token)
      .then((data) => {
        if (cancelled) return;
        setLastName(data.last_name ?? '');
        setFirstName(data.first_name ?? '');
        setPreview({ status: 'ready', preview: data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 404) setPreview({ status: 'invalid' });
        else if (status === 410) setPreview({ status: 'expired' });
        else {
          logWarn('Не удалось загрузить приглашение');
          setPreview({ status: 'network' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const retry = () => {
    setPreview({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  const passwordsMatch = password === confirm;
  const canSubmit =
    preview.status === 'ready' &&
    isValidPassword(password) &&
    passwordsMatch &&
    !submitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    const result = await handleAcceptInvitation({
      token,
      password,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    });
    if (result.success) return;

    setSubmitting(false);
    if (result.accepted) {
      setMustLogin(true);
      setError(
        'Пароль сохранён, но войти автоматически не получилось. Войдите с почтой и паролем.',
      );
    } else if (result.status === 409) {
      setMustLogin(true);
      setError('Эта почта уже зарегистрирована. Войдите в сервис.');
    } else if (result.status === 404) {
      setPreview({ status: 'invalid' });
    } else if (result.status === 410) {
      setPreview({ status: 'expired' });
    } else {
      setError('Не удалось принять приглашение. Попробуйте ещё раз.');
    }
  };

  const state: PreviewState = token ? preview : { status: 'invalid' };

  return (
    <div className="min-h-screen bg-[#F3F4F8] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-130 p-8 sm:p-15">
        <div className="mx-auto mb-6.25">
          <Image
            alt="Ассистент врача"
            className="logo mx-auto"
            src="/logo.svg"
            width={299}
            height={38}
          />
        </div>

        {state.status === 'loading' && (
          <div
            role="status"
            aria-label="Загрузка"
            className="mx-auto my-10 h-10 w-10 animate-spin rounded-full border-b-2 border-[#5D8CF1]"
          />
        )}

        {state.status === 'invalid' && (
          <Message text="Ссылка недействительна или уже использована" />
        )}

        {state.status === 'expired' && (
          <Message text="Срок приглашения истёк. Попросите администратора клиники отправить новое." />
        )}

        {state.status === 'network' && (
          <div className="text-center">
            <Message text="Не удалось загрузить приглашение" />
            <button type="button" onClick={retry} className={LINK_CLASS}>
              Повторить
            </button>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <h2 className="text-center text-[#6F6F6F] mb-2">
              Приглашение в клинику
            </h2>
            <p className="text-center text-lg text-[#202020] mb-7.5">
              {state.preview.clinic_name}
            </p>

            {isAuthenticated && user && (
              <p className="mb-5 rounded-lg bg-[#FFF6E5] p-3 text-sm text-[#6C5A2E]">
                Вы вошли как {user.login}. После принятия приглашения вход
                выполнится под новой учётной записью.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="invite-email" className={LABEL_CLASS}>
                  Почта
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={state.preview.email}
                  readOnly
                  disabled
                  className={`${INPUT_CLASS} ${fieldFillClass(state.preview.email)}`}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="invite-last-name" className={LABEL_CLASS}>
                    Фамилия
                  </label>
                  <input
                    id="invite-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    maxLength={255}
                    disabled={submitting}
                    className={`${INPUT_CLASS} ${fieldFillClass(lastName)}`}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="invite-first-name" className={LABEL_CLASS}>
                    Имя
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    maxLength={255}
                    disabled={submitting}
                    className={`${INPUT_CLASS} ${fieldFillClass(firstName)}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invite-password" className={LABEL_CLASS}>
                  Пароль
                </label>
                <div className="relative">
                  <input
                    id="invite-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={`Не короче ${PASSWORD_MIN_LENGTH} символов`}
                    disabled={submitting}
                    className={`${INPUT_CLASS} ${fieldFillClass(password)} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Скрыть пароль' : 'Показать пароль'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer rounded"
                  >
                    <Image
                      src={
                        showPassword ? '/showPassIcon.svg' : '/hidePassIcon.svg'
                      }
                      alt=""
                      width={20}
                      height={20}
                      className="w-5 h-5 icon-gray"
                    />
                  </button>
                </div>
                {password && !isValidPassword(password) && (
                  <p className="mt-1 text-xs text-[#E53E3E]">
                    От {PASSWORD_MIN_LENGTH} до 128 символов
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="invite-confirm" className={LABEL_CLASS}>
                  Повторите пароль
                </label>
                <input
                  id="invite-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={submitting}
                  className={`${INPUT_CLASS} ${fieldFillClass(confirm)}`}
                />
                {confirm && !passwordsMatch && (
                  <p className="mt-1 text-xs text-[#E53E3E]">
                    Пароли не совпадают
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm text-[#E53E3E]">
                  {error}{' '}
                  {mustLogin && (
                    <Link href="/login" className={LINK_CLASS}>
                      Перейти ко входу
                    </Link>
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="cursor-pointer h-11.75 w-full py-3 bg-[#5D8CF1] mt-2.5 hover:bg-[#769CEF] text-white rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <div className="animate-spin mx-auto rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  'Войти'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const Message = ({ text }: { text: string }) => (
  <p className="my-6 text-center text-[#202020]">{text}</p>
);
