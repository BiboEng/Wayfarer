#!/bin/sh
# Starts as root only to fix ownership of the mounted volume (Fly.io mounts it root-owned),
# then drops to the unprivileged "node" user and replaces itself with the server (so signals reach node).
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data 2>/dev/null && chown -R node:node /data 2>/dev/null || true
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
