/** Authored against all three approved 1672 × 941 MindHome images, top-left origin. */
export type MindHomeCondition = "cool-air" | "sun-shade" | "rain-green";
export const CONDITIONS: readonly MindHomeCondition[] = ["cool-air", "sun-shade", "rain-green"];
export const IMAGE_ASPECT = 1672 / 941;
export type ImagePoint = readonly [number, number];
export type ImagePolygon = readonly ImagePoint[];
export interface ImageRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export const REGISTRATION = {
  // Includes the sloping roof and glazed room: rain must never enter this region.
  shelter: [[.385, .425], [.928, .300], [.982, .443], [.978, .798], [.401, .724]] as ImagePolygon,
  farMist: [[.085, .372], [.192, .331], [.300, .336], [.382, .397], [.387, .617], [.276, .640], [.144, .583]] as ImagePolygon,
  aboveRoofMist: [[.425, .313], [.550, .306], [.689, .288], [.733, .316], [.548, .351], [.448, .371]] as ImagePolygon,
  water: [[.165, .788], [.217, .757], [.272, .747], [.330, .748], [.381, .751], [.435, .763], [.417, .799], [.366, .826], [.310, .850], [.255, .862], [.186, .859]] as ImagePolygon,
  stones: [
    [[.275, .748], [.284, .727], [.307, .724], [.322, .746], [.318, .773], [.284, .775]],
    [[.318, .751], [.335, .738], [.351, .742], [.361, .761], [.353, .779], [.323, .776]],
    [[.184, .794], [.199, .782], [.216, .787], [.227, .807], [.222, .823], [.187, .825]],
  ] as readonly ImagePolygon[],
  rainExterior: [
    [[.116, .345], [.251, .309], [.384, .387], [.389, .696], [.324, .744], [.204, .742], [.122, .618]],
    [[.409, .150], [.861, .143], [.887, .295], [.619, .349], [.449, .381], [.407, .337]],
  ] as readonly ImagePolygon[],
  foreground: [[0, .873], [.163, .839], [.278, .872], [.433, .817], [.519, .792], [.494, 1], [0, 1]] as ImagePolygon,
  waterRippleCenters: [[.237, .813], [.374, .790], [.278, .836]] as readonly ImagePoint[],
} as const;

/** Deterministic low-cost sampling; never a source of per-visit randomness. */
export function deterministicSample(index: number, salt = 0): number {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x119de1f3);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function pointInPolygon(point: ImagePoint, polygon: ImagePolygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isWater(point: ImagePoint): boolean {
  return pointInPolygon(point, REGISTRATION.water) && !REGISTRATION.stones.some(stone => pointInPolygon(point, stone));
}

export function isRainExterior(point: ImagePoint): boolean {
  return REGISTRATION.rainExterior.some(region => pointInPolygon(point, region)) && !pointInPolygon(point, REGISTRATION.shelter);
}

/** A contained photographic stage keeps every structural landmark; no condition-specific crop. */
export function fitImageRect(width: number, height: number, imageAspect = IMAGE_ASPECT): ImageRect {
  const safeWidth = Math.max(0, width), safeHeight = Math.max(0, height);
  const fitWidth = Math.min(safeWidth, safeHeight * imageAspect);
  const fitHeight = fitWidth / imageAspect;
  return { x: (safeWidth - fitWidth) / 2, y: (safeHeight - fitHeight) / 2, width: fitWidth, height: fitHeight };
}
