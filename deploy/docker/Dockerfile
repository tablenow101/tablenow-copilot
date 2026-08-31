FROM node:26-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/console/package.json apps/console/package.json
COPY services/core-api/package.json services/core-api/package.json
COPY services/computer-use-runner/package.json services/computer-use-runner/package.json
COPY services/integration-simulator/package.json services/integration-simulator/package.json
COPY services/worker/package.json services/worker/package.json
COPY services/sync-gateway/package.json services/sync-gateway/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/provider-adapters/package.json packages/provider-adapters/package.json
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
RUN pnpm install --frozen-lockfile

COPY . .
ARG CORE_API_INTERNAL_URL=http://core-api:4000
ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV CORE_API_INTERNAL_URL=$CORE_API_INTERNAL_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm build
RUN pnpm --filter @tablenow/core-api deploy --prod --config.inject-workspace-packages=true /out/core-api \
  && pnpm --filter @tablenow/computer-use-runner deploy --prod --config.inject-workspace-packages=true /out/computer-use-runner \
  && pnpm --filter @tablenow/integration-simulator deploy --prod --config.inject-workspace-packages=true /out/integration-simulator \
  && pnpm --filter @tablenow/worker deploy --prod --config.inject-workspace-packages=true /out/worker \
  && pnpm --filter @tablenow/sync-gateway deploy --prod --config.inject-workspace-packages=true /out/sync-gateway \
  && pnpm --filter @tablenow/mcp-server deploy --prod --config.inject-workspace-packages=true /out/mcp-server

FROM node:26-bookworm-slim AS runtime-services

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out /app
RUN mkdir -p /data/exports /data/computer-evidence && chown -R node:node /data

USER node
EXPOSE 4000 4100

FROM node:26-bookworm-slim AS runtime-runner

ENV NODE_ENV=production
ENV COMPUTER_CHROMIUM_PATH=/usr/bin/chromium
WORKDIR /app/computer-use-runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /out/computer-use-runner /app/computer-use-runner
RUN mkdir -p /data/browser-profiles && chown -R node:node /data

USER node

FROM node:26-bookworm-slim AS runtime-console

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/console

COPY --from=build --chown=node:node /workspace/apps/console/.next/standalone /app

USER node
EXPOSE 3000
