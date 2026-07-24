import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { mountOpenApiDocs } from './openapi.js';
import { listModules } from '../plugins/module-registry.js';
import { i18nMiddleware } from '../i18n/index.js';
// Imports à effet de bord : chaque fichier de routes s'enregistre lui-même
// via registerModule() en bas de son fichier. Ajouter un nouveau module ne
// nécessite qu'une ligne ici, aucune autre modification de app.ts/server.ts.
import './routes/neighbourhoods.js';
import './routes/wallet.js';
import './routes/listings.js';
import './routes/documents.js';
import './routes/events.js';
import './routes/messages.js';
import './routes/message-attachments.js';
import './routes/polls.js';
import './routes/gdpr.js';
import './routes/plugins.js';
import './routes/incidents.js';
import './routes/admin-stats.js';
import './routes/desktop-version.js';
import './routes/social.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(i18nMiddleware);
  mountOpenApiDocs(app);
  app.use(healthRouter);
  app.use(authRouter);
  for (const mod of listModules()) {
    app.use(mod.router);
  }
  return app;
}
