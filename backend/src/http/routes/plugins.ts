import { Router } from 'express';
import { requireAuth } from '../../auth/middleware.js';
import { listPollPluginDescriptors } from '../../plugins/registry.js';
import { builtinPlugins } from '../../plugins/bootstrap.js';
import { registerModule } from '../../plugins/module-registry.js';

export const pluginsRouter = Router();

pluginsRouter.get('/plugins', requireAuth, (_req, res) => {
  res.status(200).json({
    boot: builtinPlugins.map((p) => ({ id: p.id, description: p.description })),
    polls: listPollPluginDescriptors(),
  });
});

registerModule({
  id: 'plugins',
  description: 'Introspection des plugins/modules Vicinity.',
  router: pluginsRouter,
});
