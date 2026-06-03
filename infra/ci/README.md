# infra/ci

Pipelines CI/CD (GitHub Actions).

Workflows à créer ici, puis référencés depuis `.github/workflows/` via
`uses: ./infra/ci/<workflow>.yml` ou copiés directement dans `.github/workflows/`
selon la convention finale.

## Workflows prévus

| Workflow            | Déclencheur     | Rôle                                                        |
|---------------------|-----------------|-------------------------------------------------------------|
| `backend-ci.yml`    | PR + push main  | `npm ci`, lint, test (avec services docker), build          |
| `web-ci.yml`        | PR + push main  | Lint + build des deux fronts React                          |
| `desktop-ci.yml`    | PR + push main  | Gradle build + tests JavaFX (TestFX en mode headless)       |
| `release.yml`       | tag `v*`        | Build images Docker, push registry, draft release           |
| `codeql.yml`        | hebdo + PR      | Analyse statique sécurité                                   |

## Conventions

- Cache `~/.npm` et `~/.gradle` par lockfile.
- Services PostgreSQL/Mongo/Neo4j via `services:` du workflow (pas via
  compose) pour éviter la dépendance à la stack DEV.
- Toujours `--frozen-lockfile` / `npm ci` (jamais `npm install` en CI).
