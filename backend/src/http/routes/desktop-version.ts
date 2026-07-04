import { Router } from 'express';
import { env } from '../../config/env.js';
import { registerModule } from '../../plugins/module-registry.js';

export const desktopVersionRouter: Router = Router();

desktopVersionRouter.get('/desktop/latest-version', (_req, res) => {
  res.json({
    version: env.DESKTOP_LATEST_VERSION,
    downloadUrl: env.DESKTOP_DOWNLOAD_URL,
  });
});

registerModule({
  id: 'desktop-version',
  description: 'Version courante du client Java pour les mises à jour automatiques.',
  router: desktopVersionRouter,
});
