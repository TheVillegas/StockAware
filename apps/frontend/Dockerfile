# Frontend Angular + Ionic. Se compila y se sirve estatico con nginx.
# Para desarrollo con recarga en caliente conviene correrlo fuera de Docker:
#   cd apps/frontend && npm start

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY angular.json tsconfig.json ./
COPY src ./src
RUN npx ng build

FROM nginx:alpine
COPY --from=build /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
