import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { EnergyGraphPresence } from "../src/nts/hologram";
import { PresenceProjectionTransition, PROJECTION_TIMING, projectionEnvelope, SpatialProjection } from "../src/nts/spatialProjection";

function fixture() {
  const normal = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: "#8ea7ad", transparent: true });
  const hair = new THREE.MeshStandardMaterial({ color: "#15191e" });
  const outfit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12).scale(.22, .22, .08).translate(0, 1.205, 0), body); outfit.name = "NTS_2J_Outfit_Continuous_Knit";
  const bun = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8).translate(0, 1.7, -.04), hair); bun.name = "NTS_Hair_SoftRomanticBun";
  normal.add(outfit, bun); normal.position.set(-4.8, -4.6, 1); normal.scale.setScalar(6);
  const graph = new EnergyGraphPresence([outfit, bun], new Map<THREE.Material, string>([[body, "body"], [hair, "hair"]]));
  const projection = new SpatialProjection([outfit, bun]); projection.group.position.copy(normal.position); projection.group.scale.copy(normal.scale);
  const changed = vi.fn(), transition = new PresenceProjectionTransition(normal, graph, projection, changed);
  return { normal, body, hair, graph, projection, changed, transition, release: () => { transition.dispose(); graph.dispose(); outfit.geometry.dispose(); bun.geometry.dispose(); body.dispose(); hair.dispose(); } };
}
const resources = (group: THREE.Group) => {
  const objects: THREE.Object3D[] = [], geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse(object => {
    objects.push(object);
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  });
  return { objects, geometries: [...geometries], materials: [...materials] };
};

describe("Transient registered Spatial Projection", () => {
  it("has a readable middle beat with finite smooth boundaries and no third settled mode", () => {
    expect(PROJECTION_TIMING.duration).toBe(4000);
    expect(projectionEnvelope(0)).toMatchObject({ source: 1, destination: 0, field: 0 });
    for (const time of [1400, 2100, 2800]) expect(projectionEnvelope(time)).toMatchObject({ source: 0, destination: 0, field: 1, title: 1 });
    expect(projectionEnvelope(4000)).toMatchObject({ source: 0, destination: 1, field: 0, title: 0 });
    expect(projectionEnvelope(1).source).toBeGreaterThan(.999);
  });

  it("derives a bounded shoulder-width field, vector identity and reusable finite geometry", () => {
    const f = fixture(), before = resources(f.projection.group);
    expect(f.projection.inspection).toMatchObject({ geometryCount: 5, materialCount: 4, textureCount: 0, drawObjects: 5, shoulderRatio: 1.3, identity: "NuTuenSai 💙" });
    expect(f.projection.width).toBeGreaterThan(.4); expect(f.projection.width).toBeLessThan(.6);
    expect(f.projection.group.getObjectByName("Projection-identity-NuTuenSai-blue-heart")).toBeInstanceOf(THREE.Mesh);
    for (const time of [350, 900, 1400, 2100, 3000, 3800]) {
      f.projection.apply(time);
      for (const geometry of before.geometries) expect(geometry.getAttribute("position").array.every(Number.isFinite)).toBe(true);
    }
    expect(resources(f.projection.group)).toEqual(before); f.release();
  });

  it("restores exact canonical material values, graph draw ranges, transforms and references over repeated cycles", () => {
    vi.useFakeTimers();
    const f = fixture(), normalResources = resources(f.normal), graphResources = resources(f.graph.group), projectionResources = resources(f.projection.group);
    const pose = f.normal.matrix.clone(), normalMaterials = normalResources.materials.map(m => ({ opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }));
    const graphArrays = graphResources.geometries.map(g => Object.fromEntries(Object.entries(g.attributes).map(([name, attr]) => [name, Array.from(attr.array)])));
    for (let cycle = 0; cycle < 12; cycle++) for (const mode of ["hologram", "normal"] as const) {
      expect(f.transition.start(mode, false, 0)).toBe(true);
      expect(f.transition.start(mode === "normal" ? "hologram" : "normal", false, 10)).toBe(false);
      for (const now of [400, 800, 1400, 2200, 2800, 3400]) f.transition.frame(now);
      expect(f.projection.group.visible).toBe(true); expect(vi.getTimerCount()).toBe(0);
      f.transition.frame(4000);
      expect(f.transition.active).toBe(false); expect(f.projection.group.visible).toBe(false);
      expect(f.graph.inspection).toMatchObject({ mode, visible: mode === "hologram", canonicalHidden: mode === "hologram" });
      expect(normalResources.materials.map(m => ({ opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite }))).toEqual(normalMaterials);
      expect(f.normal.matrix.equals(pose)).toBe(true);
      expect(graphResources.geometries.every(g => g.drawRange.start === 0 && g.drawRange.count === Infinity)).toBe(true);
    }
    graphResources.geometries.forEach((g, i) => expect(Object.fromEntries(Object.entries(g.attributes).map(([name, attr]) => [name, Array.from(attr.array)]))).toEqual(graphArrays[i]));
    expect(resources(f.normal)).toEqual(normalResources); expect(resources(f.graph.group)).toEqual(graphResources); expect(resources(f.projection.group)).toEqual(projectionResources);
    f.release(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
  });

  it("settles interruption and Reduced Motion immediately, cancels the outgoing pulse and disposes only owned resources", () => {
    vi.useFakeTimers(); const f = fixture();
    f.transition.start("hologram", false, 0); f.transition.frame(1700); f.transition.cancel();
    expect(f.graph.inspection).toMatchObject({ mode: "hologram", visible: true, canonicalHidden: true });
    f.graph.pulse.setEligible(true); expect(vi.getTimerCount()).toBe(1);
    f.transition.start("normal", false, 0); expect(vi.getTimerCount()).toBe(0);
    f.transition.frame(1200); f.transition.cancel();
    expect(f.projection.group.visible).toBe(false); expect(f.hair.transparent).toBe(false); expect(f.hair.opacity).toBe(1);
    f.transition.start("hologram", true, 0);
    expect(f.transition.active).toBe(false); expect(f.projection.group.visible).toBe(false); expect(f.graph.inspection.visible).toBe(true);
    const owned = resources(f.projection.group), disposed = [...owned.geometries, ...owned.materials].map(resource => vi.spyOn(resource, "dispose"));
    const normalDispose = normalSpies(f.normal);
    f.transition.start("normal", false, 0); f.transition.frame(1300); f.transition.dispose(); f.transition.dispose();
    disposed.forEach(spy => expect(spy).toHaveBeenCalledTimes(1)); normalDispose.forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(f.transition.active).toBe(false); expect(f.projection.group.parent).toBeNull(); expect(vi.getTimerCount()).toBe(0);
    f.release(); vi.useRealTimers();
  });
});

function normalSpies(group: THREE.Group) { const r = resources(group); return [...r.geometries, ...r.materials].map(resource => vi.spyOn(resource, "dispose")); }
