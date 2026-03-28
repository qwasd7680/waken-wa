# Production image: Next.js standalone + SQLite (see docker-compose).
# Runner uses official Node image (includes npm/npx). Prisma CLI is installed with npm so `npx prisma` works reliably.
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
ENV DATABASE_URL=file:./prisma/build.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public
RUN pnpm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

ARG PRISMA_VERSION=7.6.0
ENV PRISMA_RUNNER=/opt/prisma-runner
RUN mkdir -p "$PRISMA_RUNNER" && cd "$PRISMA_RUNNER" \
  && npm init -y \
  && npm install "prisma@${PRISMA_VERSION}" --no-fund --no-audit

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# After standalone merge, wire local `npx prisma` to the npm-installed CLI.
RUN mkdir -p /app/node_modules/.bin \
  && ln -sf "$PRISMA_RUNNER/node_modules/.bin/prisma" /app/node_modules/.bin/prisma \
  && chown -R nextjs:nodejs /app/node_modules/.bin "$PRISMA_RUNNER"

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER root
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/docker-entrypoint.sh"]
