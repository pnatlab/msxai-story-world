import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CameraDirector } from "../src/scene/CameraDirector";
import { frameForAspect, intentionCoherence } from "../src/scene/cameraFraming";
import { createUranianEnvironment } from "../src/scene/uranianEnvironment";
import { STORY_WORLD_V0_1 as world } from "../src/world/world.v0.1";

function directorHarness() {
  const root = new EventTarget();
  const element = Object.assign(new EventTarget(), { style: {}, getRootNode: () => root });
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
  camera.position.set(7.2, 6.2, 20);
  return { camera, director: new CameraDirector(camera, element as unknown as HTMLElement, false) };
}

describe("Environmental depth and camera continuity", () => {
  it("tracks the interpolated target and hands every authored pose to real OrbitControls without reframing", () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { camera, director } = directorHarness();
    try {
      for (const aspect of [1.6, 390 / 844]) {
        for (const original of world.cameraStates) {
          const pose = frameForAspect(original, aspect);
          director.moveTo(pose);
          director.update(1000 + pose.durationMs / 2, pose.allowManualControl);
          const desired = director.target.clone().sub(camera.position).normalize();
          expect(camera.getWorldDirection(new THREE.Vector3()).dot(desired)).toBeCloseTo(1, 9);
          director.update(1000 + pose.durationMs, pose.allowManualControl);
          expect(director.isTransitioning).toBe(false);
          expect(camera.position.distanceTo(new THREE.Vector3(...pose.position))).toBeLessThan(1e-8);
          const position = camera.position.clone();
          const rotation = camera.quaternion.clone();
          director.update(2000 + pose.durationMs, pose.allowManualControl);
          expect(camera.position.distanceTo(position)).toBeLessThan(1e-8);
          expect(Math.abs(camera.quaternion.dot(rotation))).toBeCloseTo(1, 9);
        }
      }
    } finally { director.dispose(); clock.mockRestore(); }
  });

  it("settles an interrupted transition for reduced motion with the authored control policy", () => {
    const { camera, director } = directorHarness();
    const pose = world.cameraStates[0];
    director.moveTo(pose);
    director.setReducedMotion(true);
    expect(director.isTransitioning).toBe(false);
    expect(director.controls.enabled).toBe(false);
    expect(camera.position.toArray()).toEqual(pose.position);
    expect(camera.getWorldDirection(new THREE.Vector3()).dot(director.target.clone().sub(camera.position).normalize())).toBeCloseTo(1);
    director.dispose();
  });

  it("keeps HUMAN and INTENTION inside portrait framing and HUMAN below the closing reading area", () => {
    for (const id of ["intention-camera", "msxai-camera", "return-agency-camera"]) {
      const camera = new THREE.PerspectiveCamera(45, 390 / 844, 0.1, 220);
      const pose = frameForAspect(world.cameraStates.find((s) => s.id === id)!, camera.aspect);
      camera.position.set(...pose.position);
      camera.fov = pose.fov;
      camera.setViewOffset(390, 844, 0, -844 * 0.15, 390, 844);
      camera.lookAt(new THREE.Vector3(...pose.target));
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      for (const nodeId of id === "intention-camera" ? ["human", "intention"] : ["human", "msxai"]) {
        const node = world.nodes.find((n) => n.id === nodeId)!;
        const point = new THREE.Vector3(...node.position).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(0.85);
        expect(point.y).toBeGreaterThan(-0.75);
        expect(point.y).toBeLessThan(0.1);
      }
    }
  });

  it("uses a bounded, non-repeating coherence envelope with an immediate reduced-motion endpoint", () => {
    expect(intentionCoherence(-100, false)).toBe(0);
    expect(intentionCoherence(700, false)).toBeGreaterThan(0);
    expect(intentionCoherence(700, false)).toBeLessThan(1);
    expect(intentionCoherence(1450, false)).toBe(1);
    expect(intentionCoherence(60000, false)).toBe(1);
    expect(intentionCoherence(0, true)).toBe(1);
  });

  it("keeps the local environment bounded, texture-free, and outside semantic identity", () => {
    const { group, aurora } = createUranianEnvironment();
    let meshes = 0;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
      expect(object.userData.nodeId).toBeUndefined();
      if (!mesh.isMesh) return;
      meshes += 1;
      expect(mesh.geometry.attributes.position.count).toBeLessThan(5000);
      expect(Object.values(mesh.material.uniforms).some((uniform) => uniform.value instanceof THREE.Texture)).toBe(false);
      mesh.geometry.dispose(); mesh.material.dispose();
    });
    expect(meshes).toBeLessThanOrEqual(4);
    expect(aurora.uniforms.uTime.value).toBe(0);
  });
});
