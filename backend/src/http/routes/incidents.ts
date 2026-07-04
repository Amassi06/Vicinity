import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  IncidentCategoryCreateSchema,
  IncidentCreateSchema,
  IncidentListQuerySchema,
  IncidentStatusUpdateSchema,
} from '../../incidents/schemas.js';
import {
  createIncident,
  createIncidentCategory,
  deleteIncidentCategory,
  listIncidentCategories,
  listIncidents,
  updateIncidentStatus,
} from '../../incidents/service.js';
import { registerModule } from '../../plugins/module-registry.js';

export const incidentsRouter: Router = Router();

const IdParam = z.object({ id: z.string().min(1) });

function parseId(req: Request): string | null {
  const parsed = IdParam.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

// --- Catégories d'incidents (référentiel admin) ---

incidentsRouter.get('/incident-categories', requireAuth, async (_req, res) => {
  const items = await listIncidentCategories();
  res.json({ items });
});

incidentsRouter.post(
  '/admin/incident-categories',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const parsed = IncidentCategoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
      return;
    }
    try {
      const created = await createIncidentCategory(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      res.status(message === 'slug_already_used' ? 409 : 400).json({ error: message });
    }
  },
);

incidentsRouter.delete(
  '/admin/incident-categories/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const id = parseId(req);
    if (!id) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const ok = await deleteIncidentCategory(id);
    res.status(ok ? 204 : 404).send();
  },
);

incidentsRouter.get('/incidents', requireAuth, async (req, res) => {
  const parsed = IncidentListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues });
    return;
  }
  const items = await listIncidents(parsed.data);
  res.json({ items });
});

incidentsRouter.post('/incidents', requireAuth, async (req, res) => {
  const parsed = IncidentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    return;
  }
  try {
    const incident = await createIncident(req.auth!.sub, parsed.data);
    res.status(201).json(incident);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    res.status(message === 'invalid_category' ? 400 : 500).json({ error: message });
  }
});

incidentsRouter.patch(
  '/incidents/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const id = parseId(req);
    if (!id) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = IncidentStatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
      return;
    }
    const result = await updateIncidentStatus(id, parsed.data.status, parsed.data.expectedUpdatedAt);
    if (!result.ok) {
      res.status(result.reason === 'not_found' ? 404 : 409).json({ error: result.reason });
      return;
    }
    res.json(result.incident);
  },
);

registerModule({
  id: 'incidents',
  description: 'Incidents et alertes de quartier signalés par les résidents.',
  router: incidentsRouter,
});
