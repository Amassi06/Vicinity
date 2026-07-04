import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  EventModel,
  IncidentModel,
  ListingModel,
  PollModel,
} from '../../db/mongo/models/index.js';
import { registerModule } from '../../plugins/module-registry.js';

export const adminStatsRouter: Router = Router();

const QuerySchema = z.object({
  neighbourhoodId: z.string().uuid(),
});

/**
 * Statistiques de participation des résidents d'un quartier — comptages
 * simples, pas d'agrégation complexe (messages/votes ne portent pas de
 * neighbourhoodId direct et sont volontairement exclus de ce périmètre).
 */
adminStatsRouter.get(
  '/admin/stats',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues });
      return;
    }
    const { neighbourhoodId } = parsed.data;
    const [listings, events, polls, incidents, openIncidents] = await Promise.all([
      ListingModel.countDocuments({ neighbourhoodId }),
      EventModel.countDocuments({ neighbourhoodId }),
      PollModel.countDocuments({ neighbourhoodId }),
      IncidentModel.countDocuments({ neighbourhoodId }),
      IncidentModel.countDocuments({ neighbourhoodId, status: { $ne: 'resolved' } }),
    ]);
    res.json({ neighbourhoodId, listings, events, polls, incidents, openIncidents });
  },
);

registerModule({
  id: 'admin-stats',
  description: 'Statistiques de participation des résidents (admin).',
  router: adminStatsRouter,
});
