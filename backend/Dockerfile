# syntax=docker/dockerfile:1
# Contexte de build : la RACINE du dépôt (voir infra/docker/docker-compose.full.yml),
# car l'image embarque aussi la spec OpenAPI servie sur /docs.
# Base Debian slim (et non Alpine) : les moteurs Prisma exigent OpenSSL glibc.

# ---------- Étape 1 : compilation TypeScript + client Prisma ----------
FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

# ---------- Étape 2 : image d'exécution ----------
# node_modules complet (la CLI Prisma est nécessaire pour `migrate deploy` au
# démarrage : la stack se lance de zéro avec un simple `docker compose up`).
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/prisma ./prisma
COPY backend/package.json ./
COPY docs/api ./docs/api
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
