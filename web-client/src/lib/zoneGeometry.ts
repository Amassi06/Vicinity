export interface Point {
  x: number;
  y: number;
}

export interface ClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DrawnZone {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
}

export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: ClientRect,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  const scaleX = rect.width === 0 ? 1 : canvasWidth / rect.width;
  const scaleY = rect.height === 0 ? 1 : canvasHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function isZoneTooSmall(width: number, height: number, minSize: number): boolean {
  return width < minSize || height < minSize;
}

export function buildZoneFromCorners(
  corner1: Point,
  corner2: Point,
  page: number,
  required: boolean,
): DrawnZone {
  return {
    page,
    x: Math.min(corner1.x, corner2.x),
    y: Math.min(corner1.y, corner2.y),
    width: Math.abs(corner2.x - corner1.x),
    height: Math.abs(corner2.y - corner1.y),
    required,
  };
}
