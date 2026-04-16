FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy the entire standalone bundle first. Depending on the build environment,
# Next may emit either `/app/.next/standalone/server.js` or
# `/app/.next/standalone/web-app/server.js`.
COPY --from=builder /app/.next/standalone ./standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

RUN set -eux; \
    SERVER_PATH="$(find ./standalone -maxdepth 3 -type f -name server.js | head -n 1)"; \
    if [ -n "${SERVER_PATH}" ]; then \
      SERVER_DIR="$(dirname "${SERVER_PATH}")"; \
      cp -R "${SERVER_DIR}/". ./; \
    else \
      echo "Next standalone output missing server.js" >&2; \
      find ./standalone -maxdepth 3 -type f | sort >&2; \
      exit 1; \
    fi; \
    rm -rf ./standalone

RUN adduser -D nextjs && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
