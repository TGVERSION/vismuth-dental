import type { NextConfig } from 'next';
import { MOCK_NAMES, parseMocks, type MockName } from './src/lib/mocks';

const API_MAIN_URL = process.env.API_MAIN_URL || 'http://localhost:8000';
const API_ML_URL = process.env.API_ML_URL || 'http://localhost:8001';

// Фронтенд обращается к backend и ml-service через собственные rewrites
// (/api/main, /api/ml), то есть same-origin — CORS-заголовки ему не нужны.
// Переменная нужна только если появится внешний потребитель прокси:
// тогда задаётся ровно один origin, звёздочка недопустима.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN?.trim();

const isDev = process.env.NODE_ENV !== 'production';

// Заглушки backend (src/lib/mocks.ts). MOCKS — имена через запятую или `all`;
// в production-сборке заглушки включаются только так и только для
// демо-контура. Без MOCKS в разработке включены все, кроме анкет у врача при
// DOCTOR_QUESTIONNAIRES_MOCK=off; в production — ни одной. Значение
// вшивается в сборку: поменять набор можно только пересборкой образа.
const resolveMocks = (): MockName[] => {
  const raw = process.env.MOCKS?.trim();
  if (raw) {
    const { enabled, unknown } = parseMocks(raw);
    if (unknown.length) {
      console.warn(
        `MOCKS: неизвестные заглушки «${unknown.join(', ')}» пропущены. ` +
          `Доступны: ${MOCK_NAMES.join(', ')}, all.`,
      );
    }
    return enabled;
  }

  if (!isDev) return [];
  return MOCK_NAMES.filter(
    (name) =>
      name !== 'doctor-questionnaires' ||
      process.env.DOCTOR_QUESTIONNAIRES_MOCK?.trim() !== 'off',
  );
};

const MOCKS = resolveMocks();

if (isDev) {
  console.log('API_MAIN_URL:', API_MAIN_URL);
  console.log('API_ML_URL:', API_ML_URL);
  console.log('ALLOWED_ORIGIN:', ALLOWED_ORIGIN || '(не задан, CORS выключен)');
  console.log('MOCKS:', MOCKS.join(', ') || '(выключены)');
} else if (MOCKS.length) {
  console.warn(
    `ВНИМАНИЕ: production-сборка с заглушками backend: ${MOCKS.join(', ')}. ` +
      'Только для демо-контура — не для сервера с реальными пациентами.',
  );
}

// Куда заглушки перехватывают запросы к backend. Именно beforeFiles, а не
// обработчик в app/api/main/: правила из afterFiles применяются раньше
// динамических маршрутов, поэтому /speech/sessions/{id}/chunks успевал уехать
// на backend, и заглушка получала управление только на статическом
// /speech/sessions.
const MOCK_REWRITES: Record<
  MockName,
  { source: string; destination: string }[]
> = {
  // Распознавание приёма: эндпоинтов /speech/* в backend нет.
  speech: [
    {
      source: '/api/main/speech/:path*',
      destination: '/api/speech-mock/:path*',
    },
  ],
  // Публичная анкета пациента (`/public/*` backend) — для dev и демо-контура
  // без базы и ML. Серверный рендер страницы анкеты идёт за брендингом через
  // собственный сервер (src/api/server-api.ts) и попадает под то же правило.
  // Правило перехватывает ВЕСЬ `/public/*`: в backend это сейчас только
  // роутер анкеты (routers/public_questionnaire.py). Появится другой
  // публичный роутер — правило нужно сузить.
  questionnaire: [
    {
      source: '/api/main/public/:path*',
      destination: '/api/questionnaire-mock/:path*',
    },
  ],
  // Анкеты у врача. ПЕРЕКРЫВАЕТ настоящий backend: в базе нет обработанных
  // анкет. Отдельное правило для пути без хвоста — список живёт ровно на
  // /questionnaires. Когда удалять — в
  // src/app/api/doctor-questionnaires-mock/_mock/guard.ts.
  'doctor-questionnaires': [
    {
      source: '/api/main/questionnaires',
      destination: '/api/doctor-questionnaires-mock',
    },
    {
      source: '/api/main/questionnaires/:path*',
      destination: '/api/doctor-questionnaires-mock/:path*',
    },
  ],
};

// Прокси к backend по умолчанию обрывает запрос через 30 с. Проверку для ДМС
// backend ждёт до 600 с (CLINREC_DMS_TIMEOUT), остальные ML-запросы — до
// 180 с; свой таймаут у каждого клиента в src/api/main-api.ts.
const PROXY_TIMEOUT_MS = 610_000;

if (ALLOWED_ORIGIN === '*') {
  throw new Error(
    'ALLOWED_ORIGIN=* недопустимо: прокси отдаёт медицинские данные. ' +
      'Укажите конкретный origin или не задавайте переменную вовсе.',
  );
}

// Заголовки безопасности для всех маршрутов.
const securityHeaders = [
  // Встраивание в чужие страницы не предусмотрено ни одним сценарием:
  // запрещаем полностью, чтобы форму протокола нельзя было перекрыть
  // прозрачным слоем (кликджекинг).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // URL экрана протокола содержит ?id=<protocol_id> — наружу его не отдаём.
  { key: 'Referrer-Policy', value: 'same-origin' },
];

const corsHeaders = ALLOWED_ORIGIN
  ? [
      { key: 'Access-Control-Allow-Origin', value: ALLOWED_ORIGIN },
      { key: 'Vary', value: 'Origin' },
      {
        key: 'Access-Control-Allow-Methods',
        value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      },
      {
        key: 'Access-Control-Allow-Headers',
        value: 'Content-Type,Authorization',
      },
    ]
  : [];

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    proxyTimeout: PROXY_TIMEOUT_MS,
  },
  // Набор заглушек — в код маршрутов заглушек и серверных запросов
  // (src/lib/mocks.ts). Вшивается при сборке, как и правила ниже.
  env: {
    VISMUTH_MOCKS: MOCKS.join(','),
  },
  async rewrites() {
    return {
      // Запросы к backend, которые перехватывают включённые заглушки.
      // Остальное уходит на настоящий сервер через afterFiles.
      beforeFiles: [
        // Внутренний классификатор вызывается backend напрямую. Сюда также
        // направляем вложенные пути, до общего ML proxy в afterFiles.
        {
          source: '/api/ml/questionnaire_answer_guard/:path*',
          destination: '/api/internal-ml-denied',
        },
        ...MOCKS.flatMap((name) => MOCK_REWRITES[name]),
      ],
      afterFiles: [
        {
          source: '/api/main/:path*',
          destination: `${API_MAIN_URL}/:path*`,
        },
        {
          source: '/api/ml/:path*',
          destination: `${API_ML_URL}/:path*`,
        },
      ],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...(corsHeaders.length
        ? [{ source: '/api/:path*', headers: corsHeaders }]
        : []),
    ];
  },
  compress: true,
  reactStrictMode: process.env.NODE_ENV !== 'production',
};

export default nextConfig;
