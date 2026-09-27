'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { LoginRequest, mainApi } from '@/api';
import { toast } from 'react-toastify';
import { useAuth } from '@/hooks/useAuth';
import { handleClickEmail } from '@/hooks/openEmail';
type AuthMode = 'login' | 'register' | 'verify';
export default function AuthForms() {
  const { handleLogin, handleRegister, handleConfirmRegistration } = useAuth();

  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showPasswordRegist, setShowPasswordRegist] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [userData, setUserData] = useState<LoginRequest>({
    login: '',
    password: '',
  });
  const [code, setCode] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(300);
  const [loading, setLoading] = useState(false);
  const canResend = timer === 0;

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (mode !== 'verify' || timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 4);
      const newCode = Array(4).fill('');

      for (let i = 0; i < Math.min(digits.length, 4); i++) {
        newCode[i] = digits[i];
      }

      setCode(newCode);

      if (digits.length >= 4) {
        const submitButton = document.querySelector(
          'button[type="submit"]',
        ) as HTMLButtonElement;
        submitButton?.focus();
      } else {
        const nextIndex = digits.length;
        if (nextIndex < 4) {
          inputRefs.current[nextIndex]?.focus();
        }
      }
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 4);

    if (!pastedData) return;

    const newCode = Array(4).fill('');
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }

    setCode(newCode);

    if (pastedData.length >= 4) {
      const submitButton = document.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      submitButton?.focus();
    } else {
      const nextIndex = pastedData.length;
      if (nextIndex < 4) {
        inputRefs.current[nextIndex]?.focus();
      }
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 3) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }

    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await handleLogin(userData);

    setLoading(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await handleRegister(userData);

    if (result.success) {
      setMode('verify');
      setTimer(300);
    }
    setLoading(false);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');

    if (fullCode.length !== 4) {
      toast.warning('Введите 4-значный код');
      return;
    }

    setLoading(true);

    const result = await handleConfirmRegistration(userData.login, fullCode);

    if (result.success) {
      setCode(['', '', '', '']);
    }
    setLoading(false);
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setLoading(true);

    try {
      await mainApi.serviceUsers.register(userData);
      toast.info('Код отправлен повторно');
      setTimer(300);
      setCode(['', '', '', '']);
    } catch {
      toast.error('Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUserData({ login: '', password: '' });
    setCode(['', '', '', '']);
    setTimer(300);
  };

  const switchToLogin = () => {
    resetForm();
    setMode('login');
  };

  const switchToRegister = () => {
    resetForm();
    setMode('register');
  };

  return (
    <div className="min-h-screen bg-[#F3F4F8] mx-auto my-auto flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-130 p-15">
        <div className="mx-auto mb-6.25">
          <Image
            alt="logo"
            className="logo mx-auto"
            src="/logo.svg"
            width={299}
            height={38}
          />
        </div>
        {mode === 'login' && (
          <>
            <h2 className="text-center text-[#6F6F6F] mb-8.75">Вход</h2>
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Почта
                </label>
                <input
                  type="email"
                  value={userData.login}
                  onChange={(e) =>
                    setUserData({ ...userData, login: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPasswordLogin ? 'text' : 'password'}
                    value={userData.password}
                    minLength={8}
                    onChange={(e) =>
                      setUserData({ ...userData, password: e.target.value })
                    }
                    placeholder="Введите..."
                    className="w-full px-3 py-2 pr-10 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer rounded transition-colors disabled:opacity-50"
                    disabled={loading}
                    aria-label={
                      showPasswordLogin ? 'Скрыть пароль' : 'Показать пароль'
                    }
                  >
                    <Image
                      src={
                        showPasswordLogin
                          ? '/showPassIcon.svg'
                          : '/hidePassIcon.svg'
                      }
                      alt={
                        showPasswordLogin ? 'Скрыть пароль' : 'Показать пароль'
                      }
                      width={20}
                      height={20}
                      className="w-5 h-5 icon-gray"
                    />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer h-11.75 w-full py-3 bg-[#5D8CF1] mt-2.5 hover:bg-[#769CEF] text-white rounded-xl transition-colors"
              >
                {loading ? (
                  <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Войти'
                )}
              </button>
            </form>
            <div className="flex justify-center mt-7.5 text-sm">
              {/* <button
        type="button"
                onClick={() => console.log('Forgot password')}
                disabled={loading}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors"
              >
                Забыли пароль?
              </button> */}
              <button
                type="button"
                onClick={switchToRegister}
                disabled={loading}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors"
              >
                Зарегистрироваться
              </button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <h2 className="text-center text-[#6C757D] mb-8.75">Регистрация</h2>
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Почта
                </label>
                <input
                  type="email"
                  value={userData.login}
                  onChange={(e) =>
                    setUserData({ ...userData, login: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPasswordRegist ? 'text' : 'password'}
                    value={userData.password}
                    minLength={8}
                    onChange={(e) =>
                      setUserData({ ...userData, password: e.target.value })
                    }
                    placeholder="Введите..."
                    className="w-full px-3 py-2 pr-10 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordRegist(!showPasswordRegist)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer rounded transition-colors disabled:opacity-50"
                    disabled={loading}
                    aria-label={
                      showPasswordRegist ? 'Скрыть пароль' : 'Показать пароль'
                    }
                  >
                    <Image
                      src={
                        showPasswordRegist
                          ? '/showPassIcon.svg'
                          : '/hidePassIcon.svg'
                      }
                      alt={
                        showPasswordRegist ? 'Скрыть пароль' : 'Показать пароль'
                      }
                      width={20}
                      height={20}
                      className="w-5 h-5 icon-gray"
                    />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full h-11.75 py-3 cursor-pointer bg-[#5D8CF1] hover:bg-[#769CEF] mt-2.5 text-white rounded-xl transition-colors"
              >
                {loading ? (
                  <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Зарегистрироваться'
                )}
              </button>
            </form>
            <div className="text-center mt-7.5">
              <button
                type="button"
                onClick={switchToLogin}
                disabled={loading}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors text-sm"
              >
                Войти
              </button>
            </div>
          </>
        )}

        {mode === 'verify' && (
          <>
            <button
              type="button"
              onClick={switchToRegister}
              disabled={loading}
              className="relative cursor-pointer -top-22 -left-8 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Image
                alt="back"
                className="logo mx-auto"
                src="/arrow-left.svg"
                width={25}
                height={25}
              />
            </button>
            <div className="text-center flex flex-col items-center -mt-8 mb-7.5">
              <h2 className="text-[#202020] font-bold mb-2 text-lg">
                Для завершения регистрации введите код <br />
                из письма на почте
              </h2>
              <p
                className="text-lg w-fit text-[#5D8CF1] hover:text-[#769CEF] font-bold cursor-pointer"
                onClick={() => {
                  handleClickEmail(userData.login);
                }}
              >
                {userData.login}
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div className="flex justify-center gap-3">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    className="w-12 h-14 text-center text-xl font-semibold bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                    disabled={loading}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={code.some((d) => !d) || loading}
                className="w-full h-11.75 py-3 bg-[#5D8CF1] hover:bg-[#769CEF] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {loading ? (
                  <div className="animate-spin mx-auto my- rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Продолжить'
                )}
              </button>
            </form>

            <div className="text-center mt-5">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Выслать код повторно
                </button>
              ) : (
                <p className="text-sm text-gray-600 shrink-0">
                  Выслать письмо повторно через {formatTime(timer)}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
