import { z } from 'zod';

export const IncidentCreateSchema = z.object({
  neighbourhoodId: z.string().uuid(),
  title: z.string().min(3).max(160),
  description: z.string().max(4000).default(''),
  category: z.string().min(1).max(80),
});

export type IncidentCreateInput = z.infer<typeof IncidentCreateSchema>;

export const IncidentListQuerySchema = z.object({
  neighbourhoodId: z.string().uuid().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
});

export type IncidentListQuery = z.infer<typeof IncidentListQuerySchema>;

export const IncidentStatusUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export type IncidentStatusUpdateInput = z.infer<typeof IncidentStatusUpdateSchema>;

export const IncidentCategoryCreateSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type IncidentCategoryCreateInput = z.infer<typeof IncidentCategoryCreateSchema>;
