# syntax=docker/dockerfile:1
# Tidemark as a single container: FrankenPHP (Caddy + PHP) serving the app, with the scheduler running beside it.
# Everything that changes lives in the /data volume: .env, the SQLite database, uploads and logs.

FROM composer:2 AS build
WORKDIR /app
COPY . /app
RUN composer install --no-dev --optimize-autoloader --classmap-authoritative --no-interaction --no-scripts --prefer-dist

FROM dunglas/frankenphp:1-php8.4-alpine

RUN install-php-extensions pdo_mysql pdo_pgsql pdo_sqlite mbstring bcmath intl zip opcache \
    && apk add --no-cache tzdata su-exec tini \
    && addgroup -g 1000 tidemark && adduser -D -u 1000 -G tidemark tidemark

ARG VERSION=dev
WORKDIR /app
COPY --from=build --chown=tidemark:tidemark /app /app
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/tidemark-entrypoint
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-tidemark.ini

RUN echo "${VERSION}" > /app/VERSION \
    && rm -rf /app/tests /app/dist /app/.github /app/.git /app/storage \
    && ln -s /data/storage /app/storage \
    && ln -s /data/.env /app/.env \
    && ln -s /data/database.sqlite /app/database/database.sqlite \
    && mkdir -p /data /config /app/bootstrap/cache \
    && chown tidemark:tidemark /app \
    && chown -R tidemark:tidemark /data /config /app/bootstrap/cache \
    && chmod +x /usr/local/bin/tidemark-entrypoint

# The release is immutable: updates mean pulling a newer image, not the in-app updater.
ENV TIDEMARK_UPDATER=false \
    TIDEMARK_MODE=self-hosted \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    HOME=/config \
    XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/config \
    SERVER_NAME=:8080

# The paths the app writes to (storage, .env, the SQLite file) are symlinks into /data made at build time, so nothing under /app has
# to change at start. That lets the image run with a read-only root filesystem: mount /data, /config, /tmp and /app/bootstrap/cache
# writable (tmpfs for the last three) and set TIDEMARK_HOSTED=true, which also keeps /data/.env owner-only. tini is PID 1 so stray
# child processes are reaped.
# Starts as root only to match the owner of /data to PUID/PGID (default 1000), then drops to that user.
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["/sbin/tini", "--", "tidemark-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
