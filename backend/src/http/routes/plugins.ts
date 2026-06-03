import { Router } from 'express';
import { requireAuth } from '../../auth/middleware.js';
import { listPollPluginDescriptors } from '../../plugins/registry.js';
import { builtinPlugins } from '../../plugins/bootstrap.js';

export const pluginsRouter = Router();

pluginsRouter.get('/plugins', requireAuth, (_req, res) => {
  res.status(200).json({
    boot: builtinPlugins.map((p) => ({ id: p.id, description: p.description })),
    polls: listPollPluginDescriptors(),
  });
});
