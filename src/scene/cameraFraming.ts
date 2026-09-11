import type { CameraState } from "../world/world.schema";

/** Presentation only: the semantic world and its coordinates stay shared. */
export function frameForAspect(state: CameraState, aspect: number): CameraState {
  if (aspect >= 0.85) {
    if (state.id === "ecosystem-overview-camera") {
      return { ...state, position: [12, 12, 23], target: [-0.8, 3.4, -16] };
    }
    if (["mindhome-camera", "mss-camera", "mhb-camera", "wave-glass-camera", "nutuensai-camera", "lli-camera"].includes(state.id)) {
      // Keep the near MSxAI ornaments from filling the reading area in later beats.
      return { ...state, position: [state.position[0], Math.max(6.2, state.position[1]), 10], fov: 48 };
    }
    return state;
  }
  const poses: Record<string, Pick<CameraState, "position" | "target" | "fov">> = {
    "opening-camera": { position: [3, 7, 22], target: [0, 2, -2], fov: 46 },
    "human-camera": { position: [3.5, 4.8, 13.5], target: [0, 1.5, 1], fov: 44 },
    "intention-camera": { position: [4, 6.5, 19], target: [1.5, 2, -1.5], fov: 46 },
    "msxai-camera": { position: [1.5, 11, 33], target: [0, 3, -9], fov: 48 },
    "ecosystem-overview-camera": { position: [0.5, 12, 38], target: [0, 4, -15], fov: 48 },
    "return-agency-camera": { position: [1, 12, 37], target: [0, 3, -10], fov: 49 },
  };
  const pose = poses[state.id] ?? {
    position: [state.target[0] + 3, state.target[1] + 3.5, state.target[2] + 15] as const,
    target: state.target,
    fov: 45,
  };
  return { ...state, ...pose };
}

export function intentionCoherence(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const t = Math.max(0, Math.min(1, elapsedMs / 1450));
  return t * t * (3 - 2 * t);
}
