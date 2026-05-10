# =============================================================================
# user-hub — Multi-stage Dockerfile
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY .npmrc package*.json ./
COPY tsconfig.json ./
RUN npm install && rm .npmrc
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
COPY --chown=appuser:nodejs prisma/  ./prisma/
COPY --chown=appuser:nodejs package.json ./
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
USER appuser
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]
