import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  NeighbourhoodCreateSchema,
  NeighbourhoodUpdateSchema,
} from '../../neighbourhood/schemas.js';
import * as repo from '../../neighbourhood/repository.js';
import { logger } from '../../logger/index.js';
import { registerModule } from '../../plugins/module-registry.js';

const router = Router();

const UuidParam = z.object({ id: z.string().uuid() });

router.get('/neighbourhoods', requireAuth, async (_req: Request, res: Response) => {
  const all = await repo.listNeighbourhoods();
  res.status(200).json(all);
});

// Liste minimale (id + nom) sans authentification : consommée par le
// formulaire d'inscription, où l'utilisateur n'a pas encore de compte.
// Déclarée avant `/:id` pour que "public" ne soit pas capturé comme un id.
router.get('/neighbourhoods/public', async (_req: Request, res: Response) => {
  const all = await repo.listNeighbourhoods();
  res.status(200).json(all.map(({ id, name }) => ({ id, name })));
});

router.get('/neighbourhoods/:id', requireAuth, async (req: Request, res: Response) => {
  const params = UuidParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const found = await repo.getNeighbourhood(params.data.id);
  if (!found) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.status(200).json(found);
});

router.post(
  '/neighbourhoods',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const parsed = NeighbourhoodCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }
    try {
      const created = await repo.createNeighbourhood(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        res.status(409).json({ error: 'name_already_used' });
        return;
      }
      logger.error({ err }, 'create neighbourhood failed');
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

router.patch(
  '/neighbourhoods/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const params = UuidParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = NeighbourhoodUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    const updated = await repo.updateNeighbourhood(params.data.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(200).json(updated);
  },
);

router.delete(
  '/neighbourhoods/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const params = UuidParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const ok = await repo.deleteNeighbourhood(params.data.id);
    res.status(ok ? 204 : 404).send();
  },
);

// ----------------------------------------------------------------------------
// Requêtes spatiales PostGIS
// ----------------------------------------------------------------------------

const PointQuery = z.object({
  lon: z.coerce.number().gte(-180).lte(180),
  lat: z.coerce.number().gte(-90).lte(90),
});

router.get('/neighbourhoods/lookup/point', requireAuth, async (req: Request, res: Response) => {
  const parsed = PointQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query' });
    return;
  }
  const matches = await repo.findNeighbourhoodsContaining(parsed.data.lon, parsed.data.lat);
  res.status(200).json({ matches });
});

router.get(
  '/neighbourhoods/:id/overlaps',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    const params = UuidParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const overlaps = await repo.listOverlapsFor(params.data.id);
    res.status(200).json({ overlaps });
  },
);

export const neighbourhoodRouter = router;

registerModule({
  id: 'neighbourhoods',
  description: 'Modélisation géographique des quartiers (PostGIS).',
  router,
});
