# scripts

Petits scripts utilitaires de développement.

Règles :

- Bash POSIX ou Node.js (pas de dépendances exotiques).
- Préfixe par domaine : `db-`, `seed-`, `dump-`, `smoke-`, etc.
- Idempotents quand c'est possible.
- Documenter chaque script en en-tête (`# Usage: ./scripts/xxx.sh ...`).

## Scripts envisagés

| Fichier                  | Rôle                                                       |
|--------------------------|------------------------------------------------------------|
| `seed-postgres.sh`       | Injecte un jeu de données DEV (quartiers, users démo)      |
| `seed-mongo.js`          | Insère des annonces, événements et messages d'exemple     |
| `seed-neo4j.cypher`      | Peuple le graphe social pour tester les reco              |
| `smoke-health.sh`        | `curl /healthz` + `/readyz` puis exit code                |
| `dump-dev.sh`            | Snapshot des trois bases (pg_dump, mongodump, neo4j-admin)|
