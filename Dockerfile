# =============================================================================
# user-hub — Multi-stage Dockerfile
#
# Build context must include a `core/` directory (sibling @brainwave-project/core
# checkout). CI checks out brainwave-project/core into ./core before docker build.
# =============================================================================

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl

# --- Shared library (@brainwave-project/core) --------------------------------
WORKDIR /core
COPY core/package.json core/package-lock.json ./
COPY core/tsconfig.json ./
COPY core/src ./src/
RUN npm ci && npm run build

# --- user-hub ---------------------------------------------------------------
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm ci
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist         ./dist
COPY --from=builder --chown=appuser:nodejs /core            /core
COPY --chown=appuser:nodejs prisma/  ./prisma/
COPY --chown=appuser:nodejs package.json ./
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
USER appuser
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db seed && node dist/index.js"]
