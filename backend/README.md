# Backend — Vicinity

API REST Node.js + Express + TypeScript.

## Scripts

| Commande             | Effet                                           |
|----------------------|-------------------------------------------------|
| `npm run dev`        | Démarre en watch (tsx)                          |
| `npm run build`      | Compile TS → `dist/`                            |
| `npm start`          | Lance `dist/server.js`                          |
| `npm test`           | Jest + Supertest                                |
| `npm run lint`       | ESLint (type-aware)                             |
| `npm run format`     | Prettier (écriture)                             |
| `npm run db:migrate` | Applique les migrations Prisma                  |
| `npm run db:generate`| Régénère `@prisma/client`                       |

## Endpoints actifs

| Méthode | Chemin     | Description                                           |
|---------|------------|-------------------------------------------------------|
| GET     | `/healthz` | Liveness (200 immédiat)                               |
| GET     | `/readyz`  | Readiness — Postgres + Mongo + Neo4j (200 / 503)      |

## Persistance

- **PostgreSQL** : Prisma, migrations dans `prisma/migrations/`. PostGIS
  pour les polygones de quartier (colonne `boundary` en `Unsupported`).
- **MongoDB** : Mongoose, modèles dans `src/db/mongo/models/`.
- **Neo4j** : driver officiel, contraintes idempotentes appliquées au boot.

Prérequis : la stack `make up` du repo racine doit tourner.
