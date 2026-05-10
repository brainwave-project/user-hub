# syntax=docker/dockerfile:1.4
# =============================================================================
# user-hub — Multi-stage Dockerfile
# =============================================================================
# Build from service directory:
#
#   cd user-hub/
#   docker build -t user-hub .
#
# @brainwave-project/core is now a published npm package (@brainwave-project/core@^1.2.0)
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY .npmrc package*.json ./
RUN --mount=type=secret,id=GITHUB_TOKEN \
    export GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) && \
    npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY .npmrc package*.json ./
COPY tsconfig.json ./
RUN --mount=type=secret,id=GITHUB_TOKEN \
    export GITHUB_TOKEN=$(cat /run/secrets/GITHUB_TOKEN) && \
    npm ci
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser
COPY --from=deps    --chown=appuser:nodejs /app/node_modules         ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist                 ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=appuser:nodejs prisma/  ./prisma/
COPY --chown=appuser:nodejs package.json ./
USER appuser
EXPOSE 3001
CMD ["node", "dist/index.js"]
