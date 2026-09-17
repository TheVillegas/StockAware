# Backend NestJS replica.
# Two stages: compile with full dependencies, prune to production, then copy
# the pruned tree into a runtime image that does not keep npm.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Patch Alpine OpenSSL (libssl3/libcrypto3) and drop npm/corepack so Trivy
# does not flag the Node image's bundled npm HIGH/CRITICAL findings.
RUN apk upgrade --no-cache \
    && rm -rf \
        /usr/local/lib/node_modules/npm \
        /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm \
        /usr/local/bin/npx \
        /usr/local/bin/corepack
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
