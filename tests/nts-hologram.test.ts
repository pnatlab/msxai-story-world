import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOLOGRAM_COPY, MASK_COLORS, OUTFIT_COLORS, type PresenceMode } from "../src/nts/appearance";
import { ENERGY_PULSE_TIMING, EnergyGraphPresence } from "../src/nts/hologram";
import { AuthoredHeadTilt } from "../src/nts/microExpressions";
import { NtsVisitController } from "../src/nts/visitState";
import { LocaleController } from "../src/story/localeState";

function fixture(changed: () => void = () => {}) {
  const outfit = new THREE.MeshStandardMaterial({ color: OUTFIT_COLORS.black, emissiveIntensity: .055 });
  const skin = new THREE.MeshStandardMaterial({ color: "#ecd6c6", emissiveIntensity: .055 });
  const hair = new THREE.MeshStandardMaterial({ color: "#15191e" });
  const mask = new THREE.MeshStandardMaterial({ color: MASK_COLORS.white, emissiveIntensity: .055 });
  const eye = new THREE.MeshStandardMaterial({ vertexColors: true });
  const beauty = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const ink = new THREE.MeshBasicMaterial({ color: "#6d7b86" });
  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
  const sphere = (name: string, material: THREE.Material, scale: [number, number, number], center: [number, number, number]): void => {
    const geometry = new THREE.SphereGeometry(1, 16, 12); geometry.scale(...scale); geometry.translate(...center);
    const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(geometry, material); mesh.name = name; meshes.push(mesh);
  };
  // Baked coordinates match the canonical assembly's domains without loading assets.
  sphere("NTS_2J_Outfit_Continuous_Knit", outfit, [.222, .220, .080], [0, 1.205, 0]);
  sphere("NTS_2J_Neck_Continuous", skin, [.040, .0415, .036], [0, 1.4385, 0]);
  sphere("NTS_2C_Head_OriginalStylized", skin, [.086, .130, .083], [0, 1.555, 0]);
  sphere("NTS_Hair_SoftRomanticBun", hair, [.050, .046, .044], [-.004, 1.678, -.067]);
  sphere("NTS_2C_Hair_SweptCap", hair, [.091, .082, .086], [0, 1.607, -.004]);
  sphere("NTS_2J_Mask_Quiet_Fabric", mask, [.073, .038, .020], [0, 1.504, .081]);
  for (const [side, sign] of [["R", -1], ["L", 1]] as const) sphere(`NTS_2C_Eye_${side}`, eye, [.018, .009, .005], [sign * .038, 1.572, .075]);
  for (const [name, material, y] of [["NTS_Mask_MouseSignature", ink, 1.510], ["NTS_Beauty_SoftRose_UpperCheek", beauty, 1.550]] as const) {
    const geometry = new THREE.PlaneGeometry(.012, .008); geometry.translate(.041, y, .102);
    const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(geometry, material); mesh.name = name; meshes.push(mesh);
  }
  meshes[7].layers.enable(3); meshes[9].visible = false;
  const roles = new Map<THREE.Material, string>([[outfit, "body"], [skin, "skin"], [hair, "hair"], [mask, "mask"], [eye, "eye"], [beauty, "beauty"], [ink, "print"]]);
  const graph = new EnergyGraphPresence(meshes, roles, changed);
  const release = (): void => { graph.dispose(); meshes.forEach(mesh => mesh.geometry.dispose()); roles.forEach((_role, material) => material.dispose()); };
  return { meshes, outfit, mask, graph, release };
}

function resources(graph: EnergyGraphPresence) {
  const objects: THREE.Object3D[] = [], geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  graph.group.traverse(object => {
    if (!(object instanceof THREE.Points || object instanceof THREE.LineSegments)) return;
    objects.push(object); geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
  });
  return { objects, geometries: [...geometries], materials: [...materials] };
}

describe("Registered symbolic Hologram graph over one canonical Presence", () => {
  it("creates deterministic finite surface constellations within the canonical assembly and bounded local connections", () => {
    const a = fixture(), b = fixture(), allBounds = new THREE.Box3();
    a.meshes.forEach(mesh => { mesh.geometry.computeBoundingBox(); allBounds.union(mesh.geometry.boundingBox!); }); allBounds.expandByScalar(.003);
    const ra = resources(a.graph), rb = resources(b.graph);
    const pointObjects = ra.objects.filter((object): object is THREE.Points => object instanceof THREE.Points);
    expect(pointObjects).toHaveLength(2);
    expect(a.graph.inspection.nodeCount).toBeGreaterThan(500); expect(a.graph.inspection.nodeCount).toBeLessThan(5000);
    expect(a.graph.inspection.connectionCount).toBeGreaterThan(a.graph.inspection.nodeCount / 2);
    expect(a.graph.inspection.connectionCount).toBeLessThan(a.graph.inspection.nodeCount * 5);
    expect(a.graph.inspection.structuralSegments).toBeLessThan(5000);
    const sourceVertices = new Set(a.meshes.flatMap(mesh => {
      const p = mesh.geometry.getAttribute("position"); return Array.from({ length: p.count }, (_, i) => `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`);
    }));
    let interpolated = 0, count = 0;
    for (const object of pointObjects) {
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        expect(allBounds.containsPoint(point)).toBe(true); count++;
        if (!sourceVertices.has(`${point.x},${point.y},${point.z}`)) interpolated++;
      }
    }
    // Samples interpolate surfaces; they are not the source model's topology vertices.
    expect(interpolated / count).toBeGreaterThan(.95);
    ra.geometries.forEach((geometry, i) => {
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        expect(Array.from(attribute.array)).toEqual(Array.from(rb.geometries[i].getAttribute(name).array));
      }
    });
    expect(a.graph.inspection).toEqual(b.graph.inspection);
    a.release(); b.release();
  });

  it("keeps the same graph resources over fifty toggles and restores canonical layers, materials, colors, geometry and pose exactly", () => {
    const f = fixture(), cached = resources(f.graph), before = f.meshes.map(mesh => ({ material: mesh.material, geometry: mesh.geometry,
      attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key, attribute]) => [key, Array.from(attribute.array)])),
      layers: mesh.layers.mask, visible: mesh.visible, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone() }));
    const colors = [f.outfit.color.clone(), f.mask.color.clone()];
    expect(cached.geometries).toHaveLength(7); expect(cached.materials).toHaveLength(4);
    expect(cached.objects.every(object => !(object instanceof THREE.Mesh))).toBe(true);
    for (let cycle = 0; cycle < 50; cycle++) {
      f.graph.setMode("hologram"); expect(f.graph.group.visible).toBe(true);
      f.meshes.forEach(mesh => expect(mesh.layers.mask).toBe(0));
      f.graph.setMode("normal"); expect(f.graph.group.visible).toBe(false);
      f.meshes.forEach((mesh, i) => {
        const original = before[i]; expect(mesh.material).toBe(original.material); expect(mesh.geometry).toBe(original.geometry);
        expect(mesh.layers.mask).toBe(original.layers); expect(mesh.visible).toBe(original.visible);
        expect(mesh.position.equals(original.position) && mesh.quaternion.equals(original.quaternion) && mesh.scale.equals(original.scale)).toBe(true);
      });
    }
    expect(resources(f.graph)).toEqual(cached);
    f.meshes.forEach((mesh, i) => Object.entries(mesh.geometry.attributes).forEach(([key, attribute]) => expect(Array.from(attribute.array)).toEqual(before[i].attributes[key])));
    expect(f.outfit.color.equals(colors[0]) && f.mask.color.equals(colors[1])).toBe(true);
    expect(f.graph.inspection.textureCount).toBe(0); f.release();
  });

  it("keeps updated Normal colors and existing reading response while controlling graph availability independently", () => {
    const f = fixture(); f.graph.setMode("hologram");
    f.outfit.color.set(OUTFIT_COLORS.white); f.mask.color.set(MASK_COLORS.lavender);
    f.graph.setReading(true); expect(f.outfit.emissiveIntensity).toBe(.015); expect(f.mask.emissiveIntensity).toBe(.015);
    f.graph.setAvailable(false); expect(f.graph.group.visible).toBe(false);
    f.graph.setAvailable(true); expect(f.graph.group.visible).toBe(true);
    f.graph.setMode("normal");
    expect(f.outfit.color.getHexString()).toBe(OUTFIT_COLORS.white.slice(1)); expect(f.mask.color.getHexString()).toBe(MASK_COLORS.lavender.slice(1));
    f.graph.setReading(false); expect(f.outfit.emissiveIntensity).toBe(.055);
    f.graph.setAvailable(true); expect(f.graph.group.visible).toBe(false); f.release();
  });

  it("shares the approved temporary head pivot and restores it without moving the body or parent", () => {
    const f = fixture(), sourceHead = f.meshes.find(mesh => mesh.name.includes("Head_Original"))!;
    const parent = new THREE.Group(); parent.rotation.y = Math.PI / 4; parent.add(f.graph.group);
    const orientation = parent.quaternion.clone(), sourceBody = f.meshes[0], bodyPose = sourceBody.matrix.clone();
    const tilt = new AuthoredHeadTilt([sourceHead, f.graph.head]); f.graph.setMode("hologram");
    for (let cycle = 0; cycle < 5; cycle++) {
      tilt.begin(); tilt.apply(1); expect(tilt.degrees).toBe(-3);
      expect(f.graph.head.quaternion.equals(sourceHead.quaternion)).toBe(true); expect(f.graph.head.position.equals(sourceHead.position)).toBe(true);
      expect(parent.quaternion.equals(orientation)).toBe(true); expect(sourceBody.matrix.equals(bodyPose)).toBe(true);
      tilt.restore(); expect(tilt.neutralExact).toBe(true);
      expect(f.graph.head.position.toArray()).toEqual([0, 0, 0]); expect(f.graph.head.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
    f.release();
  });

  it("disposes only graph-owned resources once, restores source layers and detaches the graph", () => {
    const f = fixture(), cached = resources(f.graph), originalMasks = f.meshes.map(mesh => mesh.layers.mask);
    const ownDisposals = [...cached.geometries, ...cached.materials].map(resource => vi.spyOn(resource, "dispose"));
    const baseDisposals = [...f.meshes.map(mesh => mesh.geometry), ...new Set(f.meshes.map(mesh => mesh.material))].map(resource => vi.spyOn(resource, "dispose"));
    const parent = new THREE.Group(); parent.add(f.graph.group); f.graph.setMode("hologram");
    f.graph.dispose(); f.graph.dispose();
    ownDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1)); baseDisposals.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
    expect(f.graph.group.parent).toBeNull(); expect(f.graph.group.visible).toBe(false);
    f.meshes.forEach((mesh, i) => expect(mesh.layers.mask).toBe(originalMasks[i])); f.release();
  });
});

describe("Sparse authored energy pulse on existing structural paths", () => {
  afterEach(() => vi.useRealTimers());
  const buffers = (graph: EnergyGraphPresence) => resources(graph).geometries.flatMap(geometry =>
    Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, before: new Float32Array(attribute.array) })));
  const exact = (saved: ReturnType<typeof buffers>) => saved.every(({ attribute, before }) => attribute.array.every((value, i) => value === before[i]));
  const clock = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });

  it("keeps the approved static graph until one sparse wake, then travels on only three existing paths", () => {
    clock(); const changed = vi.fn(), f = fixture(changed), pulse = f.graph.pulse, saved = buffers(f.graph), refs = resources(f.graph);
    expect(pulse.inspection).toEqual({ eligible: false, timerPending: false, animating: false, pathCount: 3, baselineExact: true });
    pulse.setEligible(true); pulse.setEligible(true); expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(ENERGY_PULSE_TIMING.gaps[0] - 1); expect(changed).not.toHaveBeenCalled(); expect(exact(saved)).toBe(true);
    vi.advanceTimersByTime(1); const start = performance.now(); expect(changed).toHaveBeenCalledTimes(1);
    expect(pulse.animating).toBe(true); expect(vi.getTimerCount()).toBe(0);
    pulse.frame(start + 800); const first = saved.map(({ attribute }) => Array.from(attribute.array));
    pulse.frame(start + 1300); expect(saved.some(({ attribute }, i) => Array.from(attribute.array).some((value, j) => value !== first[i][j]))).toBe(true);
    const modified = saved.filter(({ attribute, before }) => attribute.array.some((value, i) => value !== before[i]));
    expect(modified).toHaveLength(2); expect(modified.every(item => item.name === "color")).toBe(true);
    expect(modified.reduce((count, { attribute, before }) => count + attribute.array.filter((value, i) => value !== before[i]).length, 0)).toBeLessThanOrEqual(3 * 72 * 6);
    expect(resources(f.graph)).toEqual(refs);
    pulse.frame(start + ENERGY_PULSE_TIMING.duration);
    expect(exact(saved)).toBe(true); expect(pulse.inspection).toMatchObject({ animating: false, timerPending: true, baselineExact: true });
    f.release(); expect(vi.getTimerCount()).toBe(0);
  });

  it("uses long deterministic non-metronomic gaps and restores every baseline buffer over repeated events", () => {
    clock(); const f = fixture(), pulse = f.graph.pulse, saved = buffers(f.graph), refs = resources(f.graph);
    expect(new Set(ENERGY_PULSE_TIMING.gaps).size).toBe(ENERGY_PULSE_TIMING.gaps.length);
    expect(Math.min(...ENERGY_PULSE_TIMING.gaps)).toBeGreaterThan(5 * ENERGY_PULSE_TIMING.duration);
    pulse.setEligible(true);
    for (let cycle = 0; cycle < 12; cycle++) {
      const gap = ENERGY_PULSE_TIMING.gaps[cycle % ENERGY_PULSE_TIMING.gaps.length];
      vi.advanceTimersByTime(gap - 1); expect(pulse.animating).toBe(false); expect(exact(saved)).toBe(true);
      vi.advanceTimersByTime(1); const start = performance.now(); expect(pulse.animating).toBe(true);
      for (const t of [0, 400, 1000, 1700, ENERGY_PULSE_TIMING.duration]) pulse.frame(start + t);
      expect(exact(saved)).toBe(true); expect(resources(f.graph)).toEqual(refs); expect(vi.getTimerCount()).toBe(1);
    }
    f.release(); expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels to exact static state for motion preference, inspection, smile and visibility ownership", () => {
    clock(); const f = fixture(), pulse = f.graph.pulse, saved = buffers(f.graph);
    for (let event = 0; event < 5; event++) {
      pulse.setEligible(true); vi.advanceTimersToNextTimer(); pulse.frame(performance.now() + 900);
      expect(exact(saved)).toBe(false); pulse.setEligible(false);
      expect(pulse.inspection).toMatchObject({ eligible: false, animating: false, timerPending: false, baselineExact: true });
      expect(exact(saved)).toBe(true); expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(30000); expect(pulse.animating).toBe(false);
    }
    f.release();
  });

  it("mode/availability changes and disposal cancel the same cached pulse without changing graph resources", () => {
    clock(); const f = fixture(), pulse = f.graph.pulse, saved = buffers(f.graph), refs = resources(f.graph);
    f.graph.setMode("hologram"); pulse.setEligible(true); vi.advanceTimersToNextTimer(); pulse.frame(performance.now() + 1000);
    f.graph.setMode("normal"); expect(exact(saved)).toBe(true); expect(vi.getTimerCount()).toBe(0);
    f.graph.setMode("hologram"); pulse.setEligible(true); vi.advanceTimersToNextTimer(); pulse.frame(performance.now() + 1000);
    f.graph.setAvailable(false); expect(exact(saved)).toBe(true); expect(vi.getTimerCount()).toBe(0);
    f.graph.setAvailable(true); expect(pulse.inspection.timerPending).toBe(false);
    pulse.setEligible(true); expect(vi.getTimerCount()).toBe(1); expect(resources(f.graph)).toEqual(refs);
    f.release(); pulse.setEligible(true); expect(vi.getTimerCount()).toBe(0); expect(pulse.inspection.eligible).toBe(false);
  });
});

describe("Visit-local Hologram choice", () => {
  it("changes only presentation while preserving colors, memory and user orientation", () => {
    const nts = new NtsVisitController(); nts.enter(true); nts.select("s4"); nts.inspect(45);
    nts.setOutfit("black"); nts.setMask("white"); const before = nts.getState();
    nts.setPresentation("hologram"); expect(nts.getState()).toEqual({ ...before, presentation: "hologram" });
    nts.setOutfit("white"); nts.setMask("lavender"); nts.setPresentation("normal");
    expect(nts.getState()).toEqual({ ...before, outfit: "white", mask: "lavender" });
  });

  it("keeps Hologram through mark inspection and Escape without resetting colors or orientation", () => {
    const nts = new NtsVisitController(); nts.enter(true); nts.inspect(-45); nts.setOutfit("black");
    nts.setPresentation("hologram"); const before = nts.getState();
    nts.inspectMark(true); expect(nts.getState()).toEqual({ ...before, markInspection: true });
    expect(nts.escape()).toBe(true); expect(nts.getState()).toEqual(before);
  });

  it("starts each fresh visit in Normal with Blue/Lavender, including Reduced Motion", () => {
    for (const reduced of [false, true]) {
      const nts = new NtsVisitController(); nts.enter(reduced); nts.settle();
      expect(nts.getState()).toMatchObject({ presentation: "normal", outfit: "blue", mask: "lavender" });
      nts.setPresentation("hologram"); nts.setOutfit("black"); nts.setMask("white");
      expect(nts.enter(reduced)).toBe(false); expect(nts.getState().presentation).toBe("hologram");
      nts.requestReturn(); nts.finishReturn(); nts.enter(reduced);
      expect(nts.getState()).toMatchObject({ presentation: "normal", outfit: "blue", mask: "lavender", inspection: false, markInspection: false });
    }
  });

  it("ignores invalid, duplicate and non-settled choices", () => {
    const nts = new NtsVisitController(); const closed = nts.getState();
    nts.setPresentation("hologram"); expect(nts.getState()).toBe(closed);
    nts.enter(false); const approaching = nts.getState();
    nts.setPresentation("hologram"); expect(nts.getState()).toBe(approaching);
    nts.settle(); const normal = nts.getState();
    nts.setPresentation("normal"); nts.setPresentation("neon" as PresenceMode); expect(nts.getState()).toBe(normal);
    nts.setPresentation("hologram"); nts.requestReturn(); const returning = nts.getState();
    nts.setPresentation("normal"); expect(nts.getState()).toBe(returning);
  });

  it("uses the existing live EN/TH locale source for its control label", () => {
    const locale = new LocaleController();
    locale.setLocale("en"); expect(HOLOGRAM_COPY[locale.getLocale()]).toBe("Hologram");
    locale.setLocale("th"); expect(HOLOGRAM_COPY[locale.getLocale()]).toBe("โฮโลแกรม");
    locale.setLocale("en"); expect(HOLOGRAM_COPY[locale.getLocale()]).toBe("Hologram");
  });
});
