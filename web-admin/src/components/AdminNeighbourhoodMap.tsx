import { type MutableRefObject, useEffect, useRef, type ReactElement } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { BoundedNeighbourhoodMap } from './BoundedNeighbourhoodMap.js';
import { styleForNeighbourhoodId } from '../lib/mapStyle.js';
import { polygonFromPmLayer } from '../lib/geojsonPolygon.js';
import type { NeighbourhoodDto, PolygonGeoJson } from '../types/neighbourhood.js';

export type MapDrawBridge = { drawPolygon: () => void };

function MapBackgroundClick({ onClear }: { onClear: () => void }): null {
  useMapEvents({
    click(ev) {
      const target = ev.originalEvent.target as HTMLElement;
      if (target.closest('.leaflet-interactive')) return;
      onClear();
    },
  });
  return null;
}

function NeighbourhoodOverlays({
  items,
  selectedId,
  onSelect,
}: {
  items: NeighbourhoodDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): null {
  const map = useMap();
  const layersByIdRef = useRef<Map<string, L.GeoJSON>>(new Map());

  useEffect(() => {
    const fg = L.featureGroup().addTo(map);
    layersByIdRef.current = new Map();

    for (const n of items) {
      const base = styleForNeighbourhoodId(n.id);
      const layer = L.geoJSON(n.boundary as GeoJSON.GeoJsonObject, {
        pmIgnore: true,
        bubblingMouseEvents: false,
        style: {
          fillColor: base.color,
          color: base.color,
          fillOpacity: base.fillOpacity,
          weight: 2,
        },
      });
      layer.on('click', () => onSelect(n.id));
      fg.addLayer(layer);
      layersByIdRef.current.set(n.id, layer);
    }

    return () => {
      map.removeLayer(fg);
      layersByIdRef.current.clear();
    };
  }, [items, map, onSelect]);

  useEffect(() => {
    layersByIdRef.current.forEach((lyr, id) => {
      const sel = id === selectedId;
      const base = styleForNeighbourhoodId(id);
      lyr.eachLayer((sub: L.Layer) => {
        if (sub instanceof L.Path) {
          sub.setStyle({
            fillColor: base.color,
            color: base.color,
            fillOpacity: base.fillOpacity,
            weight: sel ? 5 : 2,
          });
        }
      });
    });
  }, [selectedId, items]);

  return null;
}

function AdminGeomanController({
  bridge,
  canDraw,
  onPolygonComplete,
  onDrawError,
  onAbortDrawing,
  onBridgeReady,
}: {
  bridge: MutableRefObject<MapDrawBridge | null>;
  canDraw: boolean;
  onPolygonComplete: (p: PolygonGeoJson) => void;
  onDrawError?: (msg: string) => void;
  onAbortDrawing?: () => void;
  onBridgeReady?: () => void;
}): null {
  const map = useMap();
  const onPolygonRef = useRef(onPolygonComplete);
  const canDrawRef = useRef(canDraw);
  const onDrawErrorRef = useRef(onDrawError);
  const onAbortRef = useRef(onAbortDrawing);
  onPolygonRef.current = onPolygonComplete;
  canDrawRef.current = canDraw;
  onDrawErrorRef.current = onDrawError;
  onAbortRef.current = onAbortDrawing;

  useEffect(() => {
    const onCancel = (): void => onAbortRef.current?.();
    map.on('pm:globalcancel', onCancel);
    return () => {
      map.off('pm:globalcancel', onCancel);
    };
  }, [map]);

  const onBridgeReadyRef = useRef(onBridgeReady);
  onBridgeReadyRef.current = onBridgeReady;

  useEffect(() => {
    bridge.current = {
      drawPolygon: () => {
        if (!canDrawRef.current) return;
        if (!map.pm) return;
        map.pm.disableDraw();
        map.pm.enableDraw('Polygon');
      },
    };
    onBridgeReadyRef.current?.();
    return () => {
      bridge.current = null;
    };
  }, [bridge, map]);

  useEffect(() => {
    if (!map.pm) return undefined;
    map.pm.removeControls();
    if (canDraw) {
      map.pm.addControls({
        position: 'topright',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawPolygon: true,
        drawCircle: false,
        drawText: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
        rotateMode: false,
        pinningOption: false,
        snappingOption: false,
        splitMode: false,
        scaleMode: false,
        unionMode: false,
        differenceMode: false,
      });
    }
    return () => {
      map.pm.removeControls();
    };
  }, [canDraw, map]);

  useEffect(() => {
    const handler = ((e: { layer?: L.Layer }) => {
      const layer = e.layer;
      if (!layer) return;
      try {
        if (!canDrawRef.current) {
          map.removeLayer(layer);
          map.pm.disableDraw();
          return;
        }
        const boundary = polygonFromPmLayer(layer);
        map.removeLayer(layer);
        map.pm.disableDraw();
        onPolygonRef.current(boundary);
      } catch {
        map.removeLayer(layer);
        map.pm.disableDraw();
        onDrawErrorRef.current?.('Polygone invalide (anneau fermé, 3 sommets minimum).');
      }
    }) as unknown as L.LeafletEventHandlerFn;

    map.on('pm:create', handler);
    return () => {
      map.off('pm:create', handler);
    };
  }, [map]);

  return null;
}

type Props = {
  bridge: MutableRefObject<MapDrawBridge | null>;
  items: NeighbourhoodDto[];
  selectedId: string | null;
  drawBootstrap: [number, number] | null;
  onClearSelection: () => void;
  onSelectContour: (id: string) => void;
  canDraw: boolean;
  onPolygonComplete: (p: PolygonGeoJson) => void;
  onDrawError?: (msg: string) => void;
  onAbortDrawing?: () => void;
  onBridgeReady?: () => void;
};

export function AdminNeighbourhoodMap(props: Props): ReactElement {
  const {
    bridge,
    items,
    selectedId,
    drawBootstrap,
    onClearSelection,
    onSelectContour,
    canDraw,
    onPolygonComplete,
    onDrawError,
    onAbortDrawing,
    onBridgeReady,
  } = props;

  const boundaries = items.map((n) => n.boundary);
  const showMap = boundaries.length > 0 || drawBootstrap !== null;

  if (!showMap) {
    return (
      <div className="map-empty admin-map-empty">
        <p>Carte masquée tant qu’aucune zone n’est définie.</p>
        <p className="map-empty-hint">
          Cliquez <strong>Nouveau tracé</strong> (compte ADMIN) : la carte se centre sur votre position.
        </p>
      </div>
    );
  }

  return (
    <BoundedNeighbourhoodMap
      boundaries={boundaries}
      drawBootstrap={drawBootstrap}
      className="map-wrap admin-map-wrap"
    >
      <MapBackgroundClick onClear={onClearSelection} />
      <NeighbourhoodOverlays items={items} selectedId={selectedId} onSelect={onSelectContour} />
      <AdminGeomanController
        bridge={bridge}
        canDraw={canDraw}
        onPolygonComplete={onPolygonComplete}
        onDrawError={onDrawError}
        onAbortDrawing={onAbortDrawing}
        onBridgeReady={onBridgeReady}
      />
    </BoundedNeighbourhoodMap>
  );
}
