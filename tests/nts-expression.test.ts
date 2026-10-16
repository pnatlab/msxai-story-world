import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { describe, expect, test, vi, afterEach } from "vitest";
import { AuthoredHeadTilt, EXPRESSION_TIMING, expressionEnvelope, HEAD_TILT_GESTURE, headTiltEnvelope, MicroExpressionGeometry, PresenceExpressions } from "../src/nts/microExpressions";
import { SMILE_COPY } from "../src/nts/content";

const fsModule = "node:fs";
const { readFileSync } = await import(/* @vite-ignore */ fsModule) as {
  readFileSync(path: URL): Uint8Array<ArrayBuffer>;
  readFileSync(path: URL, encoding: "utf8"): string;
};

function fixture() {
  type Range = { offset: number; count: number };
  const info = JSON.parse(readFileSync(new URL("../public/nts/presence-study.json", import.meta.url), "utf8")) as { objects: { name: string; position: Range; normal: Range; color?: Range; index: Range }[] };
  const bytes = readFileSync(new URL("../public/nts/presence-study.bin", import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const meshes = info.objects.filter(o => /^NTS_2C_(Head_|Eye_|Lid_)/.test(o.name)).map(item => {
    const geometry = new THREE.BufferGeometry();
    for (const key of ["position", "normal", "color"] as const) if (item[key]) geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(buffer, item[key]!.offset, item[key]!.count), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, item.index.offset, item.index.count), 1));
    const mesh = new THREE.Mesh(geometry, material); mesh.name = item.name; return mesh;
  });
  const definition = mergeGeometries(meshes.filter(m => m.name.includes("Lid_Upper")).map(m => m.geometry));
  const beauty = new THREE.Mesh(definition, material); beauty.name = "NTS_Beauty_SoftRose_UpperDefinition"; meshes.push(beauty);
  const discs = [-1, 1].map(sign => new THREE.CircleGeometry(.0017, 24).translate(sign * .0352, 1.5755, .074));
  const reflection = new THREE.Mesh(mergeGeometries(discs), material); reflection.name = "NTS_Eyes_StaticCatchlights"; meshes.push(reflection);
  discs.forEach(g => g.dispose());
  return { meshes, dispose: () => { meshes.forEach(m => m.geometry.dispose()); material.dispose(); } };
}

describe("Authored Presence expressions", () => {
  afterEach(() => vi.useRealTimers());
  test("bounded envelopes have a real closed hold, smooth endpoints and deterministic long gaps", () => {
    const t = EXPRESSION_TIMING;
    expect(expressionEnvelope("blink", 0)).toBe(0);
    expect(expressionEnvelope("blink", t.close)).toBe(1);
    expect(expressionEnvelope("blink", t.close + t.closed / 2)).toBe(1);
    expect(expressionEnvelope("blink", t.close + t.closed + t.reopen)).toBe(0);
    expect(expressionEnvelope("blink", 9999)).toBe(0);
    expect(expressionEnvelope("smile", t.smileIn + t.smileHold / 2)).toBe(1);
    expect(expressionEnvelope("smile", t.smileIn + t.smileHold + t.smileOut)).toBe(0);
    expect(expressionEnvelope("blink", 1)).toBeLessThan(.001);
    expect(new Set(t.gaps).size).toBe(t.gaps.length);
    expect(Math.min(...t.gaps)).toBeGreaterThan(20 * (t.close + t.closed + t.reopen));
  });
  test("one readable Gentle Smile holds its approved peak without changing Blink", () => {
    const t = EXPRESSION_TIMING;
    expect([t.close, t.closed, t.reopen, ...t.gaps]).toEqual([135, 40, 205, 8400, 12700, 10300, 16100]);
    expect([t.smileIn, t.smileHold, t.smileOut]).toEqual([650, 800, 1050]);
    expect(t.smileIn + t.smileHold + t.smileOut).toBe(2500);
    expect(expressionEnvelope("smile", 325)).toBeCloseTo(.5);
    for (const time of [650, 1050, 1450]) expect(expressionEnvelope("smile", time)).toBe(1);
    expect(expressionEnvelope("smile", 1975)).toBeCloseTo(.5);
    expect(expressionEnvelope("smile", 2500)).toBe(0);
  });
  test("repeated separate/composed poses restore all neutral buffers, visibility and transforms exactly", () => {
    const f = fixture();
    const head = f.meshes.find(m => m.name.includes("Head_"))!;
    const headBefore = new Float32Array(head.geometry.getAttribute("position").array);
    const expression = new MicroExpressionGeometry(f.meshes);
    const geometryRefs = f.meshes.map(m => m.geometry), materialRefs = f.meshes.map(m => m.material);
    for (let cycle = 0; cycle < 12; cycle++) {
      for (const [blink, smile] of [[.55, 0], [1, 0], [0, 0], [0, 1], [.6, .3], [1, 0], [0, 0]]) {
        expression.apply(blink, smile);
        for (const m of f.meshes) {
          expect(m.geometry.getAttribute("position").array.every(Number.isFinite)).toBe(true);
          expect(m.position.toArray()).toEqual([0, 0, 0]); expect(m.scale.toArray()).toEqual([1, 1, 1]);
        }
        if (blink === 1) expect(f.meshes.filter(m => m.name.includes("Eye_") || m.name.includes("Catchlight")).every(m => !m.visible)).toBe(true);
        if (!blink && !smile) expect(expression.neutralExact).toBe(true);
      }
    }
    expect(f.meshes.map(m => m.geometry)).toEqual(geometryRefs); expect(f.meshes.map(m => m.material)).toEqual(materialRefs);
    expect(head.geometry.getAttribute("position").array).toEqual(headBefore);
    expression.apply(Number.NaN, Infinity); expect(expression.neutralExact).toBe(true);
    f.dispose();
  }, 20000);
  test("a smaller aperture keeps the iris/pupil palette in its fixed local circular field", () => {
    const f = fixture(), expression = new MicroExpressionGeometry(f.meshes);
    expression.apply(.45, .5);
    const pupil = new THREE.Color("#191e20");
    for (const mesh of f.meshes.filter(m => m.name.includes("Eye_"))) {
      const p = mesh.geometry.getAttribute("position"), c = mesh.geometry.getAttribute("color"); let count = 0;
      for (let i = 0; i < p.count; i++) if (Math.abs(c.getX(i) - pupil.r) < .000001) {
        expect(Math.hypot(Math.abs(p.getX(i)) - .038, p.getY(i) - 1.5717)).toBeLessThan(.004401); count++;
      }
      expect(count).toBeGreaterThan(50);
    }
    expression.apply(0, 0); expect(expression.neutralExact).toBe(true); f.dispose();
  });
  test("one sparse scheduler wakes only for a bounded blink and follows the approved sequence", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(), changed = vi.fn(), expression = new PresenceExpressions(f.meshes, changed);
    expression.setContext({ eligible: true, idle: true });
    for (const gap of EXPRESSION_TIMING.gaps) {
      expect(vi.getTimerCount()).toBe(1); expect(expression.animating).toBe(false);
      vi.advanceTimersByTime(gap - 1); expect(expression.animating).toBe(false);
      vi.advanceTimersByTime(1); expect(expression.inspection.kind).toBe("blink"); expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(135); expression.frame(performance.now()); expect(expression.inspection.blink).toBe(1);
      vi.advanceTimersByTime(40); expression.frame(performance.now()); expect(expression.inspection.blink).toBe(1);
      vi.advanceTimersByTime(205); expression.frame(performance.now()); expect(expression.inspection.neutralExact).toBe(true);
    }
    expect(changed).toHaveBeenCalledTimes(4);
    expression.dispose(); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60000); expect(changed).toHaveBeenCalledTimes(4); f.dispose();
  });
  test("smile queues once after a complete blink; repeated activations never restart or drift", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(), expression = new PresenceExpressions(f.meshes, vi.fn());
    expression.setContext({ eligible: true, idle: true }); vi.advanceTimersByTime(8400);
    vi.advanceTimersByTime(135); expression.frame(performance.now());
    expect(expression.smile()).toBe(true); expect(expression.smile()).toBe(false);
    expect(expression.inspection).toMatchObject({ kind: "blink", smileQueued: true, blink: 1 });
    vi.advanceTimersByTime(245); expression.frame(performance.now());
    expect(expression.inspection).toMatchObject({ kind: "smile", smileQueued: false, blink: 0, smile: 0 });
    for (let cycle = 0; cycle < 6; cycle++) {
      if (cycle) expect(expression.smile()).toBe(true);
      expect(expression.smile()).toBe(false); expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(EXPRESSION_TIMING.smileIn); expression.frame(performance.now()); expect(expression.inspection.smile).toBe(1);
      vi.advanceTimersByTime(EXPRESSION_TIMING.smileHold); expression.frame(performance.now()); expect(expression.inspection.smile).toBe(1);
      vi.advanceTimersByTime(EXPRESSION_TIMING.smileOut); expression.frame(performance.now()); expect(expression.inspection.neutralExact).toBe(true);
      expect(vi.getTimerCount()).toBe(1);
    }
    expression.dispose(); f.dispose();
  });
  test("inspection, reduced motion, visibility and disposal cancel safely without stacked schedules", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(), expression = new PresenceExpressions(f.meshes, vi.fn());
    expression.setContext({ eligible: true, idle: true }); vi.advanceTimersByTime(8400);
    vi.advanceTimersByTime(90); expression.frame(performance.now());
    expression.setContext({ eligible: true, idle: false });
    expect(expression.inspection).toMatchObject({ animating: false, timerPending: false, neutralExact: true });
    expect(expression.smile()).toBe(true);
    vi.advanceTimersByTime(EXPRESSION_TIMING.smileIn); expression.frame(performance.now());
    expression.setContext({ eligible: false, idle: false });
    expect(expression.inspection).toMatchObject({ animating: false, timerPending: false, neutralExact: true }); expect(expression.smile()).toBe(false);
    for (let i = 0; i < 10; i++) expression.setContext({ eligible: true, idle: true });
    expect(vi.getTimerCount()).toBe(1);
    expression.dispose(); expression.setContext({ eligible: true, idle: true });
    expect(expression.smile()).toBe(false); expect(vi.getTimerCount()).toBe(0); f.dispose();
  });
  test("the production action shares the existing locale copy source", () => {
    expect(SMILE_COPY).toEqual({ en: "Gentle Smile", th: "ยิ้มเบา ๆ" });
  });
  test("optional tilt leads and trails the frozen eye envelope, then restores exact presentation transforms", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(), parent = new THREE.Group(); parent.rotation.y = .75; parent.add(...f.meshes);
    const geometryRefs = f.meshes.map(m => m.geometry), parentPose = parent.quaternion.toArray();
    const poses = f.meshes.map(m => ({ position: m.position.toArray(), quaternion: m.quaternion.toArray(), scale: m.scale.toArray() }));
    const tilt = new AuthoredHeadTilt(f.meshes), expression = new PresenceExpressions(f.meshes, vi.fn(), tilt);
    expression.setContext({ eligible: true, idle: false }); expect(expression.smile()).toBe(true);
    const at = (time: number) => { vi.setSystemTime(time); expression.frame(time); };
    expect(HEAD_TILT_GESTURE.degrees).toBe(-3);
    expect(headTiltEnvelope(0)).toBe(0); expect(headTiltEnvelope(700)).toBe(1); expect(headTiltEnvelope(2900)).toBe(0);
    at(100); expect(expression.inspection.smile).toBe(0); expect(tilt.degrees).toBeLessThan(0);
    expect(expression.inspection.neutralExact).toBe(false);
    at(525); expect(expression.inspection.smile).toBeCloseTo(.5);
    for (const time of [850, 1250, 1650]) { at(time); expect(expression.inspection.smile).toBe(1); expect(tilt.degrees).toBeCloseTo(-3); }
    at(2700); expect(expression.inspection.smile).toBe(0); expect(tilt.degrees).toBeLessThan(0); expect(expression.inspection.neutralExact).toBe(false);
    at(2900); expect(expression.inspection).toMatchObject({ neutralExact: true, headNeutralExact: true, tiltDegrees: 0, animating: false });
    expect(parent.quaternion.toArray()).toEqual(parentPose);
    expect(f.meshes.map(m => ({ position: m.position.toArray(), quaternion: m.quaternion.toArray(), scale: m.scale.toArray() }))).toEqual(poses);
    expect(f.meshes.map(m => m.geometry)).toEqual(geometryRefs);
    expression.dispose(); f.dispose();
  });
  test("tilted gestures queue after Blink without stacking and cancel repeatedly without drift", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const f = fixture(), expression = new PresenceExpressions(f.meshes, vi.fn(), new AuthoredHeadTilt(f.meshes));
    expression.setContext({ eligible: true, idle: true }); vi.advanceTimersByTime(8400);
    vi.advanceTimersByTime(135); expression.frame(performance.now()); expect(expression.inspection.blink).toBe(1);
    expect(expression.smile()).toBe(true); expect(expression.smile()).toBe(false);
    vi.advanceTimersByTime(245); expression.frame(performance.now());
    expect(expression.inspection).toMatchObject({ kind: "smile", blink: 0, tiltDegrees: 0 });
    for (let i = 0; i < 12; i++) {
      if (i) expect(expression.smile()).toBe(true);
      const elapsed = [100, 900, 2800][i % 3];
      vi.advanceTimersByTime(elapsed); expression.frame(performance.now());
      expect(expression.inspection.blink).toBe(0); expect(expression.inspection.tiltDegrees).toBeLessThan(0);
      if (elapsed === 900) expect(expression.inspection).toMatchObject({ smile: 1, tiltDegrees: -3 });
      else expect(expression.inspection.smile).toBe(0);
      expect(expression.smile()).toBe(false);
      if (i % 2) expression.setContext({ eligible: false, idle: false });
      else expression.cancel();
      expect(expression.inspection).toMatchObject({ neutralExact: true, headNeutralExact: true, tiltDegrees: 0, animating: false, timerPending: false });
      expression.setContext({ eligible: true, idle: true }); expect(vi.getTimerCount()).toBe(1);
    }
    expression.dispose(); expect(vi.getTimerCount()).toBe(0); f.dispose();
  });
});
