import { z } from 'zod';

export const EventCreateSchema = z.object({
  neighbourhoodId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(8000).default(''),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  lon: z.number().gte(-180).lte(180).optional(),
  lat: z.number().gte(-90).lte(90).optional(),
  address: z.string().max(500).optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

export type EventCreateInput = z.infer<typeof EventCreateSchema>;

export const EventsListQuerySchema = z.object({
  neighbourhoodId: z.string().uuid(),
});
