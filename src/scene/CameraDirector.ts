import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CameraState } from "../world/world.schema";

type CameraTransition = {
  readonly fromPosition: THREE.Vector3;
  readonly fromTarget: THREE.Vector3;
  readonly toPosition: THREE.Vector3;
  readonly toTarget: THREE.Vector3;
  readonly fromFov: number;
  readonly toFov: number;
  readonly startedAt: number;
  readonly durationMs: number;
};

export function resolveTransitionDuration(cameraState: CameraState, reducedMotion: boolean, immediate: boolean): number {
  return reducedMotion || immediate ? 0 : cameraState.durationMs;
}

export class CameraDirector {
  public readonly target = new THREE.Vector3();
  public readonly controls: OrbitControls;
  private transition?: CameraTransition;

  public constructor(
    public readonly camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    private reducedMotion: boolean,
  ) {
    this.controls = new OrbitControls(camera, element);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 5.5;
    this.controls.maxDistance = 28;
    this.controls.maxPolarAngle = Math.PI * 0.61;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.target.copy(this.target);
  }

  public moveTo(state: CameraState, immediate = false): void {
    const targetPosition = new THREE.Vector3(...state.position);
    const target = new THREE.Vector3(...state.target);
    const durationMs = resolveTransitionDuration(state, this.reducedMotion, immediate);
    this.controls.enabled = false;

    if (durationMs === 0) {
      this.camera.position.copy(targetPosition);
      this.target.copy(target);
      this.camera.fov = state.fov;
      this.camera.updateProjectionMatrix();
      this.controls.target.copy(this.target);
      this.controls.enabled = state.allowManualControl;
      this.transition = undefined;
      return;
    }

    this.transition = {
      fromPosition: this.camera.position.clone(),
      fromTarget: this.target.clone(),
      toPosition: targetPosition,
      toTarget: target,
      fromFov: this.camera.fov,
      toFov: state.fov,
      startedAt: performance.now(),
      durationMs,
    };
  }

  public update(now: number, allowManualControl: boolean): boolean {
    if (this.transition) {
      const elapsed = Math.min((now - this.transition.startedAt) / this.transition.durationMs, 1);
      const eased = elapsed < 0.5 ? 2 * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 2) / 2;
      this.camera.position.lerpVectors(this.transition.fromPosition, this.transition.toPosition, eased);
      this.target.lerpVectors(this.transition.fromTarget, this.transition.toTarget, eased);
      this.camera.fov = THREE.MathUtils.lerp(this.transition.fromFov, this.transition.toFov, eased);
      this.camera.updateProjectionMatrix();
      this.controls.target.copy(this.target);
      if (elapsed === 1) {
        this.transition = undefined;
        this.controls.enabled = allowManualControl;
      }
      return true;
    }
    this.controls.enabled = allowManualControl;
    if (allowManualControl) this.controls.update();
    this.target.copy(this.controls.target);
    return false;
  }

  public get isTransitioning(): boolean {
    return Boolean(this.transition);
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced && this.transition) {
      const finalState: CameraState = {
        id: "reduced-motion-cut",
        position: [this.transition.toPosition.x, this.transition.toPosition.y, this.transition.toPosition.z],
        target: [this.transition.toTarget.x, this.transition.toTarget.y, this.transition.toTarget.z],
        fov: this.transition.toFov,
        durationMs: 0,
        allowManualControl: true,
      };
      this.moveTo(finalState, true);
    }
  }

  public dispose(): void {
    this.controls.dispose();
    this.transition = undefined;
  }
}
