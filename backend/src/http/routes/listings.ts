import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../auth/middleware.js';
import {
  CategoryCreateSchema,
  ListingCreateSchema,
  ListingListQuerySchema,
} from '../../listings/schemas.js';
import {
  acceptListing,
  adminDeleteListing,
  cancelContract,
  cancelListing,
  completeContract,
  createCategory,
  createListing,
  deleteCategory,
  getContract,
  getListing,
  listCategories,
  listListings,
  signContract,
} from '../../listings/service.js';
import { registerModule } from '../../plugins/module-registry.js';

export const listingsRouter: Router = Router();

const IdParam = z.object({ id: z.string().min(1) });

function parseId(req: Request): string | null {
  const parsed = IdParam.safeParse(req.params);
  return parsed.success ? parsed.data.id : null;
}

const CONTRACT_ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  invalid_state: 409,
  already_signed: 409,
  cannot_accept_own_listing: 409,
  already_accepted: 409,
  insufficient_funds: 402,
  invalid_category: 400,
};

// ----------------------------------------------------------------------------
// Catégories
// ----------------------------------------------------------------------------

listingsRouter.get('/listing-categories', requireAuth, async (_req, res) => {
  const items = await listCategories();
  res.json({ items });
});

listingsRouter.post(
  '/admin/listing-categories',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const parsed = CategoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
      return;
    }
    try {
      const created = await createCategory(parsed.data);
      res.status(201).json(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      res.status(message === 'slug_already_used' ? 409 : 400).json({ error: message });
    }
  },
);

listingsRouter.delete(
  '/admin/listing-categories/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const id = parseId(req);
    if (!id) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const ok = await deleteCategory(id);
    res.status(ok ? 204 : 404).send();
  },
);

// ----------------------------------------------------------------------------
// Annonces
// ----------------------------------------------------------------------------

listingsRouter.get('/listings', requireAuth, async (req, res) => {
  const parsed = ListingListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', issues: parsed.error.issues });
    return;
  }
  const items = await listListings(parsed.data);
  res.json({ items });
});

listingsRouter.post('/listings', requireAuth, async (req, res) => {
  const parsed = ListingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    return;
  }
  try {
    const listing = await createListing(req.auth!.sub, parsed.data);
    res.status(201).json(listing);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

listingsRouter.get('/listings/:id', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const listing = await getListing(id);
  if (!listing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(listing);
});

listingsRouter.delete(
  '/listings/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    const id = parseId(req);
    if (!id) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const ok = await adminDeleteListing(id);
    res.status(ok ? 204 : 404).send();
  },
);

listingsRouter.post('/listings/:id/cancel', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await cancelListing(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    const status = message === 'forbidden' ? 403 : 409;
    res.status(status).json({ error: message });
  }
});

listingsRouter.post('/listings/:id/accept', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const result = await acceptListing(id, req.auth!.sub);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

// ----------------------------------------------------------------------------
// Contrats : consultation, signatures, fin de vie
// ----------------------------------------------------------------------------

listingsRouter.get('/contracts/:id', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const contract = await getContract(id, req.auth!.sub, req.auth!.role === 'ADMIN');
    if (!contract) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(contract);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

listingsRouter.post('/contracts/:id/sign', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await signContract(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

listingsRouter.post('/contracts/:id/complete', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await completeContract(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

listingsRouter.post('/contracts/:id/cancel', requireAuth, async (req, res) => {
  const id = parseId(req);
  if (!id) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  try {
    const updated = await cancelContract(id, req.auth!.sub);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    res.status(CONTRACT_ERROR_STATUS[message] ?? 400).json({ error: message });
  }
});

registerModule({
  id: 'listings',
  description: 'Petites annonces entre voisins, catégories, séquestre et contrats.',
  router: listingsRouter,
});
