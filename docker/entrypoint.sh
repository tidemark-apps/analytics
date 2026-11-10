#!/bin/sh
# Points the app's writable paths at the /data volume, creates the settings file on first run, and starts the scheduler.
set -e

# As root: give /data (and the few writable spots in /app) to PUID:PGID, then run this script again as that user.
# Unraid uses 99:100 (nobody:users). Starting the container as a non-root user (docker --user) skips this.
if [ "$(id -u)" = "0" ]; then
    PUID="${PUID:-1000}"
    PGID="${PGID:-1000}"
    mkdir -p /data /config
    [ "$(stat -c %u:%g /data)" = "$PUID:$PGID" ] || chown -R "$PUID:$PGID" /data
    chown -R "$PUID:$PGID" /config /app/bootstrap/cache
    chown "$PUID:$PGID" /app /app/database
    exec su-exec "$PUID:$PGID" "$0" "$@"
fi

DATA=/data
mkdir -p "$DATA/storage/app/public" "$DATA/storage/framework/cache/data" "$DATA/storage/framework/sessions" "$DATA/storage/framework/views" "$DATA/storage/logs"
# /app/storage, /app/.env and the SQLite file are symlinks into /data made when the image is built; only (re)create one that is missing or
# wrong, so a read-only root filesystem works.
link() { [ "$(readlink "$2" 2>/dev/null)" = "$1" ] || ln -sfn "$1" "$2"; }
link "$DATA/storage" /app/storage

if [ ! -f "$DATA/.env" ]; then
    cp /app/.env.example "$DATA/.env"
    KEY="base64:$(head -c 32 /dev/urandom | base64)"
    sed -i "s#^APP_KEY=.*#APP_KEY=${KEY}#" "$DATA/.env"
    sed -i "s#^LOG_STACK=.*#LOG_STACK=single#" "$DATA/.env"
fi
link "$DATA/.env" /app/.env
# hosted installs: the settings file holds secrets, keep it owner-only
[ "$TIDEMARK_HOSTED" = "true" ] && chmod 600 "$DATA/.env"

# the web installer's SQLite option writes database/database.sqlite, which lives in the volume
[ -f "$DATA/database.sqlite" ] || : > "$DATA/database.sqlite"
link "$DATA/database.sqlite" /app/database/database.sqlite

# Laravel's generated caches; on a read-only root filesystem mount a writable tmpfs here
rm -f /app/bootstrap/cache/*.php

# the scheduler: prunes old events, drains the ingest queue and looks for new versions
( while true; do php /app/artisan schedule:run >/dev/null 2>&1 || true; sleep 60; done ) &

exec "$@"
