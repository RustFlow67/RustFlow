# syntax=docker/dockerfile:1
ARG VITE_API_BASE_URL=""
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG VITE_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG VITE_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# The source-export route reads the same allowlisted project files in production.
COPY --from=builder /app/src ./src
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/README.md /app/next.config.ts /app/tsconfig.json /app/postcss.config.mjs /app/eslint.config.mjs /app/drizzle.config.ts /app/.env.example /app/.dockerignore /app/Dockerfile /app/docker-compose.yml ./

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
