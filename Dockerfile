FROM --platform=$BUILDPLATFORM oven/bun:1.4.3-alpine AS frontend-builder
WORKDIR /app/web
COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/web/ .
COPY apps/backend/src/domain/lib/pure/ /app/backend/src/domain/lib/pure/
RUN bun run build

FROM --platform=$BUILDPLATFORM oven/bun:1.4.3-alpine AS server-dependencies
WORKDIR /app/backend
COPY apps/backend/package.json apps/backend/bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM node:24-alpine
RUN apk add --no-cache su-exec ca-certificates tzdata
WORKDIR /app/backend
COPY --from=server-dependencies /app/backend/node_modules ./node_modules
COPY apps/backend/package.json ./
COPY apps/backend/src ./src
COPY --from=frontend-builder /app/backend/public ./public
COPY apps/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && mkdir -p /data/monline
ENV NODE_ENV=production \
    MONLINE_HOST=0.0.0.0 \
    MONLINE_PORT=3000 \
    MONLINE_DATA_DIR=/data/monline \
    MONLINE_LEGACY_DATA_DIR=/data \
    TZ=Europe/Istanbul
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/server.cjs"]
