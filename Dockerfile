# =============================================================================
# user-hub — Multi-stage Dockerfile
# =============================================================================

FROM node:20-alpine AS deps

ARG NPM_TOKEN

WORKDIR /app
COPY package*.json ./
RUN echo "@brainwave-project:registry=https://npm.pkg.github.com/" > .npmrc \
 && echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc \
 && npm ci --omit=dev \
 && rm .npmrc

FROM node:20-alpine AS builder

ARG NPM_TOKEN

WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN echo "@brainwave-project:registry=https://npm.pkg.github.com/" > .npmrc \
 && echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc \
 && npm ci \
 && rm .npmrc
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
