export type PolygonGeoJson = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type NeighbourhoodDto = {
  id: string;
  name: string;
  description: string | null;
  boundary: PolygonGeoJson;
  createdAt: string;
  updatedAt: string;
};
