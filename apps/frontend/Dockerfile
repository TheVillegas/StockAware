# Frontend Angular + Ionic. Built in Node, served statically with nginx.
# For hot-reload development, run outside Docker:
#   cd apps/frontend && npm start

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY angular.json tsconfig.json ./
COPY src ./src
RUN npx ng build

FROM nginx:alpine
# Patch Alpine OpenSSL in the nginx runtime so HIGH/CRITICAL libssl/libcrypto
# findings are fixed even if the backend scan would otherwise fail first.
RUN apk upgrade --no-cache
COPY --from=build /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
