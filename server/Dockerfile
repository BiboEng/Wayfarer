# Wayfarer server image. Build with the REPO ROOT as the context, so shared/ is available:
#   docker build -f server/Dockerfile -t wayfarer-server .
# tsup bundles @shared/* into dist/index.js, so shared/ is only needed while building.

# ---- build stage ----
FROM node:24-slim AS build
WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci

COPY shared shared
COPY server server
RUN cd server && npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/server

COPY --from=build --chown=node:node /app/server/package.json ./package.json
COPY --from=build --chown=node:node /app/server/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server/dist ./dist

# Default location for the cache and audio when a volume is mounted at /data.
RUN mkdir -p /data && chown node:node /data

# The entrypoint starts as root only to chown the (root-owned) Railway volume, then
# drops to the unprivileged "node" user with setpriv (util-linux, part of Debian base).
COPY server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/[[:cntrl:]]$//' /usr/local/bin/docker-entrypoint.sh && chmod 755 /usr/local/bin/docker-entrypoint.sh

# The app reads PORT from the environment (Railway sets it); 3000 is the default.
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
