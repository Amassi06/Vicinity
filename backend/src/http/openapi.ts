import fs from 'node:fs';
import path from 'node:path';
import { Router, type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

function resolveOpenApiPath(): string {
  const candidates = [
    path.join(process.cwd(), 'docs', 'api', 'openapi.yaml'),
    path.join(process.cwd(), '..', 'docs', 'api', 'openapi.yaml'),
    path.join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.yaml'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`OpenAPI spec introuvable (essayé : ${candidates.join(', ')})`);
}

const specPath = resolveOpenApiPath();

function loadOpenApiSpec(): Record<string, unknown> {
  const raw = fs.readFileSync(specPath, 'utf8');
  return YAML.parse(raw) as Record<string, unknown>;
}

export function mountOpenApiDocs(app: Express): void {
  const spec = loadOpenApiSpec();
  const router = Router();

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(fs.readFileSync(specPath, 'utf8'));
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Vicinity API — Swagger UI',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );

  app.use(router);
}
