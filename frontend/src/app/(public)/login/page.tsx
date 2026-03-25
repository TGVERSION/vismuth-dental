'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
type AuthMode = 'login' | 'register' | 'verify';
type UserData = {
  email: string;
  password: string;
};

export default function AuthForms() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [userData, setUserData] = useState<UserData>({
    email: '',
    password: '',
  });
  const [code, setCode] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(300);
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
    if (value.length > 1) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login:', userData);
    // логика входа
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Register:', userData);
    // логика регистрации
    setMode('verify');
    setTimer(300);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    console.log('Verify code:', fullCode);
    // проверка кода
  };

  const handleResendCode = () => {
    if (canResend) {
      console.log('Resend code to:', userData.email);
      setTimer(300);
      setCode(['', '', '', '']);
    }
  };

  const resetForm = () => {
    setUserData({ email: '', password: '' });
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

  const switchToVerify = () => {
    setMode('verify');
  };

  return (
    <div className="min-h-screen bg-[#F3F4F8] mx-auto my-auto flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-130 p-15">
        {/* Логотип */}
        <div className="mx-auto mb-6.25">
          <Image
            alt="logo"
            className="logo mx-auto"
            src="/logo.svg"
            width={299}
            height={38}
          />
        </div>

        {/* Форма входа */}
        {mode === 'login' && (
          <>
            <h2 className="text-center text-[#6F6F6F] mb-8.75">Вход</h2>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Почта
                </label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) =>
                    setUserData({ ...userData, email: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Пароль
                </label>
                <input
                  type="password"
                  value={userData.password}
                  minLength={8}
                  onChange={(e) =>
                    setUserData({ ...userData, password: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                className="cursor-pointer w-full py-3 bg-[#5D8CF1] mt-2.5 hover:bg-[#769CEF] text-white rounded-xl transition-colors"
              >
                Войти
              </button>
            </form>
            <div className="flex justify-between mt-7.5 text-sm">
              <button
                onClick={() => console.log('Forgot password')}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors"
              >
                Забыли пароль?
              </button>
              <button
                onClick={switchToRegister}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors"
              >
                Зарегистрироваться
              </button>
            </div>
          </>
        )}

        {/* Форма регистрации */}
        {mode === 'register' && (
          <>
            <h2 className="text-center text-[#6C757D] mb-8.75">Регистрация</h2>
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Почта
                </label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) =>
                    setUserData({ ...userData, email: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#6C757D] mb-1.25">
                  Пароль
                </label>
                <input
                  type="password"
                  value={userData.password}
                  minLength={8}
                  onChange={(e) =>
                    setUserData({ ...userData, password: e.target.value })
                  }
                  placeholder="Введите..."
                  className="w-full px-3 py-2 bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 cursor-pointer bg-[#5D8CF1] hover:bg-[#769CEF] mt-2.5 text-white rounded-xl transition-colors"
              >
                Зарегистрироваться
              </button>
            </form>
            <div className="text-center mt-7.5">
              <button
                onClick={switchToLogin}
                className="text-[#5D8CF1] hover:text-[#769CEF] cursor-pointer transition-colors text-sm"
              >
                Войти
              </button>
            </div>
          </>
        )}

        {/* Форма ввода кода */}
        {mode === 'verify' && (
          <>
            <button
              onClick={switchToRegister}
              className="relative -top-[88px] -left-[32px] text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Image
                alt="back"
                className="logo mx-auto"
                src="/arrow-left.svg"
                width={25}
                height={25}
              />
            </button>
            <div className="text-center -mt-8 mb-7.5">
              <h2 className="text-[#202020] font-bold mb-2 text-lg">
                Для завершения регистрации введите код <br />
                из письма на почте
              </h2>
              <p className="text-lg text-[#5D8CF1] font-bold">
                {userData.email}
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-5">
              {/* Поля для ввода кода */}
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
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    className="w-11 h-14.25 text-center text-xl font-semibold bg-[#F3F4F8] border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5D8CF1] transition-all"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={code.some((d) => !d)}
                className="w-full py-3 bg-[#5D8CF1] hover:bg-[#769CEF] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                Продолжить
              </button>
            </form>

            {/* Таймер и повторная отправка */}
            <div className="text-center mt-5">
              {canResend ? (
                <button
                  onClick={handleResendCode}
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
