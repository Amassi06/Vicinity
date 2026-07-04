import { z } from 'zod';

export const ListingCreateSchema = z.object({
  neighbourhoodId: z.string().uuid(),
  title: z.string().min(3).max(160),
  description: z.string().max(4000).default(''),
  kind: z.enum(['offer', 'request']),
  category: z.string().min(1).max(80),
  location: z.string().max(240).default(''),
  serviceDate: z.coerce.date().optional(),
  pricePoints: z.number().int().min(0).max(100_000).default(0),
});

export type ListingCreateInput = z.infer<typeof ListingCreateSchema>;

export const ListingListQuerySchema = z.object({
  neighbourhoodId: z.string().uuid().optional(),
  kind: z.enum(['offer', 'request']).optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed', 'cancelled']).optional(),
});

export type ListingListQuery = z.infer<typeof ListingListQuerySchema>;

export const CategoryCreateSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
