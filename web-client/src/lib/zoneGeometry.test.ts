import { describe, expect, it } from 'vitest';
import { buildZoneFromCorners, isZoneTooSmall, toCanvasPoint } from './zoneGeometry.js';

describe('toCanvasPoint', () => {
  it('maps a click 1:1 when the canvas is displayed at its native resolution', () => {
    const point = toCanvasPoint(110, 220, { left: 10, top: 20, width: 600, height: 800 }, 600, 800);
    expect(point).toEqual({ x: 100, y: 200 });
  });

  it('scales up coordinates when the canvas is displayed smaller than its native resolution', () => {
    const point = toCanvasPoint(160, 220, { left: 10, top: 20, width: 300, height: 400 }, 600, 800);
    expect(point).toEqual({ x: 300, y: 400 });
  });

  it('scales down coordinates when the canvas is displayed larger than its native resolution', () => {
    const point = toCanvasPoint(310, 420, { left: 10, top: 20, width: 1200, height: 1600 }, 600, 800);
    expect(point).toEqual({ x: 150, y: 200 });
  });

  it('falls back to a 1:1 mapping when the displayed rect has zero size', () => {
    const point = toCanvasPoint(10, 20, { left: 0, top: 0, width: 0, height: 0 }, 600, 800);
    expect(point).toEqual({ x: 10, y: 20 });
  });
});

describe('isZoneTooSmall', () => {
  it('flags a zone narrower than the minimum size', () => {
    expect(isZoneTooSmall(4, 50, 8)).toBe(true);
  });

  it('flags a zone shorter than the minimum size', () => {
    expect(isZoneTooSmall(50, 4, 8)).toBe(true);
  });

  it('accepts a zone exactly at the minimum size on both axes', () => {
    expect(isZoneTooSmall(8, 8, 8)).toBe(false);
  });

  it('accepts a zone comfortably larger than the minimum size', () => {
    expect(isZoneTooSmall(50, 50, 8)).toBe(false);
  });
});

describe('buildZoneFromCorners', () => {
  it('normalizes corners regardless of click order (bottom-right then top-left)', () => {
    const zone = buildZoneFromCorners({ x: 100, y: 100 }, { x: 20, y: 30 }, 1, true);
    expect(zone).toEqual({ page: 1, x: 20, y: 30, width: 80, height: 70, required: true });
  });

  it('normalizes corners when clicked top-left then bottom-right', () => {
    const zone = buildZoneFromCorners({ x: 20, y: 30 }, { x: 100, y: 100 }, 2, false);
    expect(zone).toEqual({ page: 2, x: 20, y: 30, width: 80, height: 70, required: false });
  });

  it('produces a zero-size zone when both corners are identical', () => {
    const zone = buildZoneFromCorners({ x: 50, y: 50 }, { x: 50, y: 50 }, 1, true);
    expect(zone).toEqual({ page: 1, x: 50, y: 50, width: 0, height: 0, required: true });
  });
});
