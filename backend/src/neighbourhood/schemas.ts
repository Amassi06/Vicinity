import { z } from 'zod';

/**
 * Validation GeoJSON Polygon (RFC 7946) :
 *  - "type" = "Polygon"
 *  - "coordinates" = tableau d'anneaux (linear rings)
 *  - Chaque anneau = ≥ 4 positions [lon, lat] et 1er == dernier (anneau fermé)
 */
const PositionSchema = z
  .tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)])
  .or(z.array(z.number()).length(2));

const LinearRingSchema = z
  .array(PositionSchema)
  .min(4)
  .refine(
    (ring) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!first || !last) return false;
      return first[0] === last[0] && first[1] === last[1];
    },
    { message: 'ring must be closed (first == last)' },
  );

export const PolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(LinearRingSchema).min(1),
});

export type PolygonGeoJson = z.infer<typeof PolygonSchema>;

export const NeighbourhoodCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  boundary: PolygonSchema,
});

export const NeighbourhoodUpdateSchema = NeighbourhoodCreateSchema.partial();
