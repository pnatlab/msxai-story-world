import type { MemoryId } from "./content";
export interface ProjectedBox { x: number; y: number; width: number; height: number; visible: boolean; }
export interface NtsComposition { image: ProjectedBox; narrative: ProjectedBox; presence: ProjectedBox; voice: ProjectedBox; controls: ProjectedBox; traces: Record<MemoryId, ProjectedBox>; mark?: ProjectedBox; presentationTransition?: boolean; }
/** One image ownership rule shared by DOM and scene, including tall tablets. */
export function compactNts(width: number, height: number): boolean { return width < 800 || width / Math.max(height, 1) < .85; }
export const TRACE_POSITIONS = [[-7.3, .65, 3], [-4.9, .2, 1.8], [-2.25, .25, .3], [.55, .15, -.3], [3.45, .1, .7], [6.1, .45, 2]] as const;
