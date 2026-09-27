import type { NextConfig } from 'next';

const API_MAIN_URL = process.env.API_MAIN_URL || 'http://localhost:8000';
const API_ML_URL = process.env.API_ML_URL || 'http://localhost:8001';

// Фронтенд обращается к backend и ml-service через собственные rewrites
// (/api/main, /api/ml), то есть same-origin — CORS-заголовки ему не нужны.
// Переменная нужна только если появится внешний потребитель прокси:
// тогда задаётся ровно один origin, звёздочка недопустима.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN?.trim();

if (process.env.NODE_ENV !== 'production') {
  console.log('API_MAIN_URL:', API_MAIN_URL);
  console.log('API_ML_URL:', API_ML_URL);
  console.log('ALLOWED_ORIGIN:', ALLOWED_ORIGIN || '(не задан, CORS выключен)');
}

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
  async rewrites() {
    return {
      // Заглушка сервиса распознавания приёма на время, пока эндпоинтов
      // /speech/* нет в backend. Только в разработке: в production запрос
      // уходит на настоящий сервер обычным путём.
      //
      // Именно beforeFiles, а не обработчик в app/api/main/: правила из
      // afterFiles применяются раньше динамических маршрутов, поэтому
      // /speech/sessions/{id}/chunks успевал уехать на backend, и заглушка
      // получала управление только на статическом /speech/sessions.
      beforeFiles:
        process.env.NODE_ENV === 'production'
          ? []
          : [
              {
                source: '/api/main/speech/:path*',
                destination: '/api/speech-mock/:path*',
              },
              // Заглушка публичной анкеты пациента: эндпоинтов
              // /questionnaire/* в backend нет. Правило действует и для
              // серверного рендера — страница анкеты ходит за брендингом на
              // собственный origin, и её запрос проходит тот же путь.
              {
                source: '/api/main/questionnaire/:path*',
                destination: '/api/questionnaire-mock/:path*',
              },
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
