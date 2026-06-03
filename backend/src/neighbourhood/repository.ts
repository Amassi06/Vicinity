import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { PolygonGeoJson } from './schemas.js';

export interface Neighbourhood {
  id: string;
  name: string;
  description: string | null;
  boundary: PolygonGeoJson;
  createdAt: Date;
  updatedAt: Date;
}

interface NeighbourhoodRow {
  id: string;
  name: string;
  description: string | null;
  boundary: PolygonGeoJson;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: NeighbourhoodRow): Neighbourhood {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    boundary: row.boundary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convertit un GeoJSON Polygon en `geometry(Polygon, 4326)` via PostGIS.
 * `ST_GeomFromGeoJSON` parse le texte JSON, `ST_SetSRID` fixe le SRID 4326
 * (WGS84, standard pour les coordonnées lat/lon).
 */
export async function createNeighbourhood(input: {
  name: string;
  description?: string | undefined;
  boundary: PolygonGeoJson;
}): Promise<Neighbourhood> {
  const rows = await prisma.$queryRaw<NeighbourhoodRow[]>`
    INSERT INTO neighbourhoods (id, name, description, boundary, updated_at)
    VALUES (
      gen_random_uuid(),
      ${input.name},
      ${input.description ?? null},
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.boundary)}), 4326),
      NOW()
    )
    RETURNING
      id, name, description,
      ST_AsGeoJSON(boundary)::jsonb AS boundary,
      created_at, updated_at;
  `;
  if (!rows[0]) throw new Error('insert_failed');
  return mapRow(rows[0]);
}

export async function listNeighbourhoods(): Promise<Neighbourhood[]> {
  const rows = await prisma.$queryRaw<NeighbourhoodRow[]>`
    SELECT id, name, description,
           ST_AsGeoJSON(boundary)::jsonb AS boundary,
           created_at, updated_at
    FROM neighbourhoods
    ORDER BY created_at DESC;
  `;
  return rows.map(mapRow);
}

export async function getNeighbourhood(id: string): Promise<Neighbourhood | null> {
  const rows = await prisma.$queryRaw<NeighbourhoodRow[]>`
    SELECT id, name, description,
           ST_AsGeoJSON(boundary)::jsonb AS boundary,
           created_at, updated_at
    FROM neighbourhoods
    WHERE id = ${id}::uuid;
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateNeighbourhood(
  id: string,
  input: {
    name?: string | undefined;
    description?: string | null | undefined;
    boundary?: PolygonGeoJson | undefined;
  },
): Promise<Neighbourhood | null> {
  const sets: Prisma.Sql[] = [];
  if (input.name !== undefined) sets.push(Prisma.sql`name = ${input.name}`);
  if (input.description !== undefined) sets.push(Prisma.sql`description = ${input.description}`);
  if (input.boundary !== undefined) {
    sets.push(
      Prisma.sql`boundary = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.boundary)}), 4326)`,
    );
  }
  if (sets.length === 0) {
    return getNeighbourhood(id);
  }
  sets.push(Prisma.sql`updated_at = NOW()`);

  const rows = await prisma.$queryRaw<NeighbourhoodRow[]>`
    UPDATE neighbourhoods
    SET ${Prisma.join(sets, ', ')}
    WHERE id = ${id}::uuid
    RETURNING
      id, name, description,
      ST_AsGeoJSON(boundary)::jsonb AS boundary,
      created_at, updated_at;
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteNeighbourhood(id: string): Promise<boolean> {
  const result = await prisma.$executeRaw`
    DELETE FROM neighbourhoods WHERE id = ${id}::uuid;
  `;
  return result > 0;
}

interface MatchRow {
  id: string;
  name: string;
}

/**
 * Retourne tous les quartiers contenant le point [lon, lat] (SRID 4326).
 * Plusieurs quartiers peuvent matcher si leurs limites se chevauchent
 * (cf. listOverlapsFor pour la détection ; cette fonction est tolérante).
 */
export async function findNeighbourhoodsContaining(
  longitude: number,
  latitude: number,
): Promise<{ id: string; name: string }[]> {
  return prisma.$queryRaw<MatchRow[]>`
    SELECT id, name
    FROM neighbourhoods
    WHERE ST_Contains(
      boundary,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
    );
  `;
}

interface OverlapRow {
  id: string;
  name: string;
  overlap_area: number;
}

/**
 * Retourne la liste des quartiers dont la limite **intersecte** celle du
 * quartier `id` (hors lui-même), avec la surface commune (degrés²).
 * Permet à l'admin de détecter immédiatement les conflits de limites.
 */
export async function listOverlapsFor(
  id: string,
): Promise<{ id: string; name: string; overlapArea: number }[]> {
  const rows = await prisma.$queryRaw<OverlapRow[]>`
    SELECT n.id, n.name,
           ST_Area(ST_Intersection(n.boundary, target.boundary)) AS overlap_area
    FROM neighbourhoods n
    JOIN neighbourhoods target ON target.id = ${id}::uuid
    WHERE n.id <> target.id
      AND ST_Intersects(n.boundary, target.boundary)
      AND NOT ST_Touches(n.boundary, target.boundary);
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, overlapArea: Number(r.overlap_area) }));
}
