import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { MindHomePresentation } from "../src/mindhome/MindHomePresentation";
import { CONDITIONS, IMAGE_ASPECT, REGISTRATION, deterministicSample, fitImageRect, isRainExterior, isWater, pointInPolygon } from "../src/mindhome/registration";

afterEach(() => vi.restoreAllMocks());

describe("MindHome authored image registration", () => {
  it("contains the same full image at every supported viewport without condition-specific crops", () => {
    for (const [width, height] of [[1440, 900], [390, 844], [375, 667], [430, 932], [844, 390]]) {
      const rect = fitImageRect(width, height);
      expect(rect.width / rect.height).toBeCloseTo(IMAGE_ASPECT, 12);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + .001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height + .001);
      expect(rect.x * 2 + rect.width).toBeCloseTo(width, 12);
      expect(rect.y * 2 + rect.height).toBeCloseTo(height, 12);
    }
    expect(fitImageRect(0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
  it("keeps roof, furniture and shelter dry; water excludes the source stones", () => {
    for (const point of [[.55, .55], [.80, .60], [.90, .68], [.56, .415]] as const) {
      expect(pointInPolygon(point, REGISTRATION.shelter)).toBe(true);
      expect(isRainExterior(point)).toBe(false);
    }
    expect(isRainExterior([.27, .52])).toBe(true);
    for (const point of REGISTRATION.waterRippleCenters) expect(isWater(point)).toBe(true);
    for (const point of [[.30, .75], [.34, .76], [.205, .80], [.51, .87], [.75, .60]] as const) expect(isWater(point)).toBe(false);
    for (const point of REGISTRATION.farMist) expect(point[1]).toBeLessThan(.7);
  });
  it("samples a bounded repeatable layout without runtime randomness", () => {
    const first = Array.from({ length: 200 }, (_, i) => deterministicSample(i, 2));
    expect(first).toEqual(Array.from({ length: 200 }, (_, i) => deterministicSample(i, 2)));
    expect(new Set(first).size).toBe(200);
    expect(first.every(value => value >= 0 && value < 1)).toBe(true);
    expect(first).not.toEqual(Array.from({ length: 200 }, (_, i) => deterministicSample(i, 3)));
  });
});

describe("MindHome bounded photographic presentation", () => {
  function setup(reducedMotion = false) {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const requests: string[] = [];
    const textures: THREE.Texture[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async url => {
      requests.push(url); const texture = new THREE.Texture(); texture.name = url; textures.push(texture); return texture;
    });
    const invalidate = vi.fn();
    const presentation = new MindHomePresentation({ invalidate, reducedMotion });
    return { presentation, requests, textures, invalidate, setTime: (time: number) => { now = time; } };
  }

  it("loads each approved texture once and returns to the identical static image after a finite event", async () => {
    const { presentation: p, requests } = setup();
    await Promise.all([p.load(), p.load()]);
    expect(requests).toHaveLength(3); expect(requests.join(" ")).toContain("mindhome/cool-air.png");
    expect(p.inspection).toMatchObject({ ready: true, currentCondition: "cool-air", effectActive: true, eventDurationMs: 1800 });
    const material = (p.scene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material;
    const original = material.map;
    expect(p.update(1900)).toBe(true);
    expect(p.update(2800)).toBe(false);
    expect(p.update(9000)).toBe(false);
    expect(p.inspection.effectActive).toBe(false); expect(material.map).toBe(original);
    p.dispose();
  });

  it("locks bounded handoffs and keeps resources stable through repeated arbitrary condition choices", async () => {
    const { presentation: p, requests, setTime } = setup(); await p.load();
    const resources = p.inspection.resources;
    const originalMap = (p.scene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.map;
    let now = 1000;
    for (let cycle = 0; cycle < 5; cycle++) {
      for (const condition of ["rain-green", "sun-shade", "cool-air"] as const) {
        setTime(now);
        expect(p.select(condition)).toBe(true);
        expect(p.select(CONDITIONS.find(other => other !== condition)!)).toBe(false);
        expect(p.inspection.requestedCondition).toBe(condition);
        expect(p.update(now + 530)).toBe(true); expect(p.inspection.currentCondition).toBe(condition);
        expect(p.update(now + 1050)).toBe(true); expect(p.inspection.transitionActive).toBe(false);
        expect(p.update(now + 1050 + p.inspection.eventDurationMs)).toBe(false);
        expect(p.inspection.resources).toEqual(resources); expect(p.inspection.effectActive).toBe(false);
        now += 4000;
      }
    }
    expect(requests).toHaveLength(3);
    expect((p.scene.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.map).toBe(originalMap);
    p.dispose(); expect(p.inspection.resources).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });

  it("Reduced Motion and document hiding settle the requested condition and cancel all finite motion", async () => {
    const { presentation: p, setTime } = setup(); await p.load();
    setTime(2000); p.select("sun-shade"); p.update(2200); p.setReducedMotion(true);
    expect(p.inspection).toMatchObject({ currentCondition: "sun-shade", transitionActive: false, effectActive: false });
    expect(p.update(3000)).toBe(false);
    expect(p.select("rain-green")).toBe(true);
    expect(p.inspection.currentCondition).toBe("rain-green"); expect(p.update(5000)).toBe(false);
    p.setReducedMotion(false); setTime(6000); p.select("cool-air"); p.update(6200); p.setVisible(false);
    expect(p.inspection).toMatchObject({ currentCondition: "cool-air", transitionActive: false, effectActive: false });
    p.setVisible(true); expect(p.update(9000)).toBe(false); p.dispose();
  });

  it("starts Reduced Motion static and disposes textures arriving after Return", async () => {
    const staticSetup = setup(true); await staticSetup.presentation.load();
    expect(staticSetup.presentation.update(1000)).toBe(false); expect(staticSetup.presentation.inspection.effectActive).toBe(false);
    staticSetup.presentation.dispose(); vi.restoreAllMocks();
    const resolvers: ((texture: THREE.Texture) => void)[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(() => new Promise(resolve => { resolvers.push(resolve); }));
    const invalidate = vi.fn(), p = new MindHomePresentation({ invalidate, reducedMotion: false });
    const loading = p.load(); p.dispose();
    const disposeEvents = vi.fn();
    for (const resolve of resolvers) { const texture = new THREE.Texture(); texture.addEventListener("dispose", disposeEvents); resolve(texture); }
    await loading;
    expect(disposeEvents).toHaveBeenCalledTimes(3); expect(invalidate).not.toHaveBeenCalled();
    expect(p.inspection).toMatchObject({ ready: false, disposed: true, resources: { geometries: 0, materials: 0, textures: 0 } });
  });
});
