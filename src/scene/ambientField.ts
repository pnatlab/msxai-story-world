import type { Vec3Tuple } from "../world/world.schema";

export type AmbientFieldLayerId = "human-latent" | "intention-convergence" | "msxai-field" | "far-depth";

export interface AmbientFieldNode {
  readonly position: Vec3Tuple;
  readonly scale: number;
  readonly brightness: number;
}

export interface AmbientFieldLayer {
  readonly id: AmbientFieldLayerId;
  readonly revealAtBeat: number;
  readonly nodes: readonly AmbientFieldNode[];
}

export interface AmbientFieldConnection {
  readonly id: string;
  readonly layer: AmbientFieldLayerId;
  readonly revealAtBeat: number;
  readonly points: readonly Vec3Tuple[];
}

/**
 * Decorative field structure only. These entries have no labels, semantics,
 * destinations, hit targets, or Story List representation.
 */
export const AMBIENT_FIELD_V0_1: {
  readonly layers: readonly AmbientFieldLayer[];
  readonly connections: readonly AmbientFieldConnection[];
} = {
  layers: [
    {
      id: "human-latent",
      revealAtBeat: 1,
      nodes: [
        { position: [-2.6, 1.8, -1.5], scale: 0.12, brightness: 0.42 },
        { position: [-1.2, 2.7, -2.8], scale: 0.08, brightness: 0.34 },
        { position: [1.7, 1.3, -1.8], scale: 0.11, brightness: 0.46 },
        { position: [2.8, 3.1, -1.1], scale: 0.07, brightness: 0.3 },
        { position: [-3.4, 0.8, 1.4], scale: 0.06, brightness: 0.26 },
        { position: [1.1, 3.8, 0.5], scale: 0.07, brightness: 0.3 },
        { position: [3.5, 1.4, -3.1], scale: 0.08, brightness: 0.36 },
        { position: [-0.7, 1.0, -4.4], scale: 0.06, brightness: 0.24 },
      ],
    },
    {
      id: "intention-convergence",
      revealAtBeat: 2,
      nodes: [
        { position: [-1.8, 3.4, -4.7], scale: 0.09, brightness: 0.42 },
        { position: [0.2, 4.5, -5.8], scale: 0.07, brightness: 0.34 },
        { position: [1.0, 1.5, -6.2], scale: 0.08, brightness: 0.36 },
        { position: [4.5, 4.0, -6.5], scale: 0.1, brightness: 0.48 },
        { position: [5.2, 1.4, -5.0], scale: 0.06, brightness: 0.28 },
        { position: [2.2, 5.5, -7.0], scale: 0.06, brightness: 0.3 },
        { position: [-3.0, 2.0, -7.4], scale: 0.07, brightness: 0.3 },
        { position: [5.8, 3.0, -8.0], scale: 0.06, brightness: 0.25 },
      ],
    },
    {
      id: "msxai-field",
      revealAtBeat: 3,
      nodes: [
        { position: [-6.5, 6.0, -10.0], scale: 0.09, brightness: 0.38 },
        { position: [-4.2, 1.5, -12.5], scale: 0.07, brightness: 0.3 },
        { position: [2.5, 7.4, -12.8], scale: 0.08, brightness: 0.36 },
        { position: [5.8, 5.6, -14.2], scale: 0.11, brightness: 0.45 },
        { position: [6.8, 1.8, -11.6], scale: 0.06, brightness: 0.27 },
        { position: [-7.2, 3.1, -15.5], scale: 0.08, brightness: 0.32 },
        { position: [-1.2, 8.4, -16.5], scale: 0.07, brightness: 0.31 },
        { position: [3.6, 2.0, -17.6], scale: 0.07, brightness: 0.29 },
        { position: [-4.0, 7.8, -18.0], scale: 0.05, brightness: 0.23 },
        { position: [7.3, 7.0, -19.4], scale: 0.06, brightness: 0.25 },
      ],
    },
    {
      id: "far-depth",
      revealAtBeat: 3,
      nodes: [
        { position: [-11.0, 8.0, -26.0], scale: 0.07, brightness: 0.2 },
        { position: [9.5, 4.0, -29.0], scale: 0.06, brightness: 0.18 },
        { position: [-2.0, 11.0, -31.0], scale: 0.08, brightness: 0.2 },
        { position: [12.0, 9.0, -35.0], scale: 0.05, brightness: 0.15 },
        { position: [-14.0, 3.0, -34.0], scale: 0.05, brightness: 0.15 },
      ],
    },
  ],
  connections: [
    {
      id: "ambient-human-left",
      layer: "human-latent",
      revealAtBeat: 1,
      points: [[-2.6, 1.8, -1.5], [-1.4, 2.3, -0.4], [0, 1.2, 1]],
    },
    {
      id: "ambient-human-right",
      layer: "human-latent",
      revealAtBeat: 1,
      points: [[2.8, 3.1, -1.1], [1.5, 2.6, 0], [0, 1.2, 1]],
    },
    {
      id: "ambient-intention-upper",
      layer: "intention-convergence",
      revealAtBeat: 2,
      points: [[-1.8, 3.4, -4.7], [0.8, 4.2, -3.8], [3, 2.7, -4.3]],
    },
    {
      id: "ambient-intention-lower",
      layer: "intention-convergence",
      revealAtBeat: 2,
      points: [[1, 1.5, -6.2], [2.2, 1.2, -5.2], [3, 2.7, -4.3]],
    },
    {
      id: "ambient-msxai-span",
      layer: "msxai-field",
      revealAtBeat: 3,
      points: [[-6.5, 6, -10], [-1, 7.2, -12.2], [5.8, 5.6, -14.2]],
    },
    {
      id: "ambient-msxai-depth",
      layer: "far-depth",
      revealAtBeat: 3,
      points: [[-7.2, 3.1, -15.5], [-2, 5.7, -22], [9.5, 4, -29]],
    },
  ],
};
