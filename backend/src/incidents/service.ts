import { IncidentModel, type IncidentEntity } from '../db/mongo/models/index.js';
import { prisma } from '../db/prisma.js';
import type {
  IncidentCategoryCreateInput,
  IncidentCreateInput,
  IncidentListQuery,
} from './schemas.js';

// ----------------------------------------------------------------------------
// Catégories d'incidents (référentiel Postgres, géré par les admins)
// ----------------------------------------------------------------------------

export async function listIncidentCategories() {
  return prisma.incidentCategory.findMany({ orderBy: { label: 'asc' } });
}

export async function createIncidentCategory(input: IncidentCategoryCreateInput) {
  const slug =
    input.slug ??
    input.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  if (!slug) throw new Error('invalid_slug');
  try {
    return await prisma.incidentCategory.create({ data: { slug, label: input.label } });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      throw new Error('slug_already_used');
    }
    throw err;
  }
}

export async function deleteIncidentCategory(id: string): Promise<boolean> {
  const res = await prisma.incidentCategory.deleteMany({ where: { id } });
  return res.count > 0;
}

// ----------------------------------------------------------------------------
// Incidents
// ----------------------------------------------------------------------------

export async function createIncident(
  reporterId: string,
  input: IncidentCreateInput,
): Promise<IncidentEntity> {
  const category = await prisma.incidentCategory.findUnique({
    where: { slug: input.category },
    select: { slug: true },
  });
  if (!category) throw new Error('invalid_category');

  return IncidentModel.create({
    reporterId,
    neighbourhoodId: input.neighbourhoodId,
    title: input.title,
    description: input.description,
    category: input.category,
  });
}

export async function listIncidents(query: IncidentListQuery): Promise<IncidentEntity[]> {
  return IncidentModel.find(query).sort({ createdAt: -1 }).limit(200).exec();
}

/**
 * Résolution de conflit optimiste : si expectedUpdatedAt est fourni et ne
 * correspond plus à updatedAt en base, quelqu'un d'autre a modifié l'incident
 * entre-temps (utilisé par le client Java pour la synchro hors-ligne).
 */
export async function updateIncidentStatus(
  id: string,
  status: IncidentEntity['status'],
  expectedUpdatedAt?: string,
): Promise<{ ok: true; incident: IncidentEntity } | { ok: false; reason: 'not_found' | 'conflict' }> {
  const incident = await IncidentModel.findById(id);
  if (!incident) return { ok: false, reason: 'not_found' };

  if (expectedUpdatedAt && incident.updatedAt.toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
    return { ok: false, reason: 'conflict' };
  }

  incident.status = status;
  await incident.save();
  return { ok: true, incident };
}
