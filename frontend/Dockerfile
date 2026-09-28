ARG API_MAIN_URL
ARG API_ML_URL

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder

ARG API_MAIN_URL
ARG API_ML_URL
# Заглушки backend для демо-контура: имена через запятую или `all`
# (src/lib/mocks.ts). Вшиваются при сборке. На сервере с реальными
# пациентами не задавать.
ARG MOCKS=

ENV API_MAIN_URL=${API_MAIN_URL}
ENV API_ML_URL=${API_ML_URL}
ENV MOCKS=${MOCKS}

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

FROM node:20-alpine AS runner

ARG API_MAIN_URL
ARG API_ML_URL

ENV API_MAIN_URL=${API_MAIN_URL}
ENV API_ML_URL=${API_ML_URL}

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
