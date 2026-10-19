#!/bin/sh
set -eu

PUID=${PUID:-1000}
PGID=${PGID:-1000}
case "$PUID:$PGID" in
    *[!0-9:]*|:*|*:) echo "PUID and PGID must be numeric." >&2; exit 1 ;;
esac
mkdir -p "${MONLINE_DATA_DIR:-/data/monline}"
# Only the new Monline directory needs write ownership. Legacy data stays intact.
chown -R "$PUID:$PGID" "${MONLINE_DATA_DIR:-/data/monline}"
chmod 700 "${MONLINE_DATA_DIR:-/data/monline}"
exec su-exec "$PUID:$PGID" "$@"
