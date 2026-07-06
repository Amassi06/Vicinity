# syntax=docker/dockerfile:1
# Contexte de build : la RACINE du dépôt (voir infra/docker/docker-compose.full.yml).

# ---------- Étape 1 : build Vite ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY web-admin/package.json web-admin/package-lock.json ./
RUN npm ci
COPY web-admin/ ./
RUN npm run build

# ---------- Étape 2 : nginx (fichiers statiques + proxy API) ----------
FROM nginx:1.27-alpine
COPY infra/docker/nginx/web-admin.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
