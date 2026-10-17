import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import typeface from "three/examples/fonts/helvetiker_regular.typeface.json?raw";
import type { PresenceMode } from "./appearance";
import type { EnergyGraphPresence } from "./hologram";

export const PROJECTION_TIMING = { duration: 4000, sourceOut: 800, establishStart: 350, establishEnd: 1400, resolveStart: 2800 } as const;
const ease = (start: number, end: number, time: number): number => THREE.MathUtils.smoothstep(time, start, end);

export function projectionEnvelope(elapsed: number) {
  const t = THREE.MathUtils.clamp(elapsed, 0, PROJECTION_TIMING.duration);
  const form = ease(PROJECTION_TIMING.establishStart, PROJECTION_TIMING.establishEnd, t);
  const resolve = ease(PROJECTION_TIMING.resolveStart, PROJECTION_TIMING.duration, t);
  return { source: 1 - ease(0, PROJECTION_TIMING.sourceOut, t), destination: resolve,
    field: form * (1 - resolve), form, resolve, title: form * (1 - ease(2800, 3550, t)) };
}

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
const palette = [new THREE.Color("#80dcf5"), new THREE.Color("#b4a1ef"), new THREE.Color("#f5e6c5")];

/** Cached field in the canonical model's coordinates. It exists only during a switch. */
export class SpatialProjection {
  readonly group = new THREE.Group();
  private readonly field = new THREE.Group();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly glass: THREE.MeshBasicMaterial;
  private readonly lines: THREE.LineBasicMaterial;
  private readonly points: THREE.PointsMaterial;
  private readonly ink: THREE.MeshBasicMaterial;
  private readonly waves: THREE.BufferGeometry;
  private readonly waveBaseline: Float32Array;
  private readonly label: THREE.Mesh;
  readonly width: number;
  readonly height: number;
  readonly base: number;
  private disposed = false;
  private fit = 1;
  private readonly steps = 64;
  private readonly lanes = 9;
  constructor(meshes: readonly Mesh[]) {
    const body = meshes.find(mesh => mesh.name.includes("Outfit_Continuous")) ?? meshes[0];
    const all = new THREE.Box3();
    meshes.forEach(mesh => { mesh.geometry.computeBoundingBox(); all.union(mesh.geometry.boundingBox!); });
    const p = body.geometry.getAttribute("position");
    let shoulder = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 1.29 && p.getY(i) < 1.38) shoulder = Math.max(shoulder, Math.abs(p.getX(i)) * 2);
    this.width = (shoulder || all.getSize(new THREE.Vector3()).x) * 1.3;
    this.base = Math.max(all.min.y, 1.075);
    this.height = all.max.y - this.base + .012;
    this.group.name = "NTS-transient-spatial-projection"; this.group.visible = false;
    this.field.position.y = this.base; this.group.add(this.field);
    this.glass = new THREE.MeshBasicMaterial({ color: "#c2eaf2", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.lines = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.points = new THREE.PointsMaterial({ size: .0026, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.ink = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    [this.glass, this.lines, this.points, this.ink].forEach(material => this.materials.add(material));

    const surface = new THREE.PlaneGeometry(this.width, this.height, 48, 8), positions = surface.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i) / this.width + .5;
      const point = this.curve(u, positions.getY(i) + this.height / 2);
      positions.setXYZ(i, point[0], point[1], point[2]);
    }
    surface.computeVertexNormals(); this.geometries.add(surface);
    const pane = new THREE.Mesh(surface, this.glass); pane.name = "Projection-curved-glass"; this.field.add(pane);

    const borders: number[] = [], colors: number[] = [];
    const segment = (a: number[], b: number[], color: THREE.Color, strength: number) => {
      borders.push(...a, ...b); const c = color.clone().multiplyScalar(strength); colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    for (const y of [0, this.height]) for (let i = 0; i < 96; i++) segment(this.curve(i / 96, y), this.curve((i + 1) / 96, y), palette[0], .62);
    for (const u of [0, 1]) for (let i = 0; i < 20; i++) segment(this.curve(u, this.height * i / 20), this.curve(u, this.height * (i + 1) / 20), palette[1], .45);
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, b = (i + 1) / 96 * Math.PI * 2, r = this.width * (.43 + ring * .035);
      segment([Math.sin(a) * r, .002 + ring * .001, Math.cos(a) * r * .48], [Math.sin(b) * r, .002 + ring * .001, Math.cos(b) * r * .48], palette[ring], ring === 1 ? .75 : .42);
    }
    const structure = new THREE.BufferGeometry(); structure.setAttribute("position", new THREE.Float32BufferAttribute(borders, 3)); structure.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.geometries.add(structure); const outline = new THREE.LineSegments(structure, this.lines); outline.name = "Projection-field-and-base-rings"; this.field.add(outline);

    this.waves = new THREE.BufferGeometry();
    this.waves.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.lanes * this.steps * 6), 3));
    this.waves.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.lanes * this.steps * 6), 3));
    this.waveBaseline = new Float32Array(this.lanes * this.steps * 6);
    for (let lane = 0; lane < this.lanes; lane++) for (let i = 0; i < this.steps * 2; i++) {
      const color = palette[lane % 3], at = (lane * this.steps * 2 + i) * 3;
      this.waveBaseline.set([color.r, color.g, color.b], at);
    }
    this.geometries.add(this.waves); const flow = new THREE.LineSegments(this.waves, this.lines); flow.name = "Projection-cyan-lavender-ivory-flow"; this.field.add(flow);

    const sparks: number[] = [], sparkColors: number[] = [];
    for (let i = 0; i < 48; i++) {
      const u = ((i * .61803398875) % 1), y = this.height * (.16 + ((i * .41421356237) % 1) * .76);
      sparks.push(...this.curve(u, y)); sparkColors.push(...palette[i % 3].toArray());
    }
    const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sparks, 3)); pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(sparkColors, 3));
    this.geometries.add(pointGeometry); this.field.add(new THREE.Points(pointGeometry, this.points));

    const font = new FontLoader().parse(JSON.parse(typeface));
    const letters = new THREE.ShapeGeometry(font.generateShapes("NuTuenSai", this.width * .085), 5);
    letters.computeBoundingBox(); const textWidth = letters.boundingBox!.max.x;
    const heart = new THREE.Shape(); heart.moveTo(0, .25); heart.bezierCurveTo(-.7, .95, -1.15, -.05, 0, -.8); heart.bezierCurveTo(1.15, -.05, .7, .95, 0, .25);
    const blueHeart = new THREE.ShapeGeometry(heart, 12); blueHeart.scale(this.width * .026, this.width * .026, 1); blueHeart.translate(textWidth + this.width * .055, this.width * .028, 0);
    for (const [geometry, color] of [[letters, new THREE.Color("#e9f7fa")], [blueHeart, new THREE.Color("#55ccff")]] as const) {
      const values = new Float32Array(geometry.getAttribute("position").count * 3);
      for (let i = 0; i < values.length; i += 3) values.set(color.toArray(), i);
      geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    }
    const labelGeometry = mergeGeometries([letters, blueHeart]); letters.dispose(); blueHeart.dispose(); labelGeometry.computeBoundingBox();
    labelGeometry.translate(-labelGeometry.boundingBox!.getCenter(new THREE.Vector3()).x, 0, 0);
    this.geometries.add(labelGeometry); this.label = new THREE.Mesh(labelGeometry, this.ink); this.label.name = "Projection-identity-NuTuenSai-blue-heart";
    this.label.position.set(0, this.height * .77, .045); this.field.add(this.label);
    this.group.traverse(object => { object.frustumCulled = false; object.renderOrder = 3; });
  }
  private curve(u: number, y: number): number[] {
    const angle = (u - .5) * 1.16, radius = this.width / (2 * Math.sin(.58));
    return [Math.sin(angle) * radius, y, .025 + (Math.cos(angle) - 1) * radius];
  }
  faceCamera(camera: THREE.Camera, width = typeof window === "undefined" ? 1440 : window.innerWidth, height = typeof window === "undefined" ? 900 : window.innerHeight): void {
    this.group.updateWorldMatrix(true, false);
    const center = this.group.getWorldPosition(new THREE.Vector3());
    this.group.rotation.y = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
    this.group.updateWorldMatrix(true, false);
    const xs = [-1, 1].flatMap(x => [0, 1].map(y => {
      const point = new THREE.Vector3(x * this.width / 2, this.base + y * this.height, 0);
      this.group.localToWorld(point); point.project(camera); return (point.x + 1) * width / 2;
    }));
    const midpoint = (Math.min(...xs) + Math.max(...xs)) / 2, half = (Math.max(...xs) - Math.min(...xs)) / 2;
    this.fit = Math.min(1, Math.max(.4, Math.min(midpoint - 12, width - midpoint - 12) / Math.max(half, 1)));
    // Portrait controls sit beside the upper field. Keep the centered identity
    // below the wave band there, rather than underneath those existing buttons.
    this.label.position.y = this.height * (width < 800 && height > width ? .34 : .77);
    // Very short views retain the same field footprint; only typography is
    // slightly enlarged within it so the identity remains readable.
    this.label.scale.setScalar(height <= 450 ? 1.12 : 1);
  }
  apply(elapsed: number): void {
    const e = projectionEnvelope(elapsed);
    this.group.visible = e.field > .0001;
    this.field.scale.set(this.fit * (.16 + e.form * .84 - e.resolve * .43), .08 + e.form * .92, .4 + e.form * .6);
    this.glass.opacity = .065 * e.field; this.lines.opacity = .64 * e.field;
    this.points.opacity = .5 * e.field; this.ink.opacity = .94 * e.title;
    this.label.visible = e.form > .65 && e.title > .001;
    const p = this.waves.getAttribute("position") as THREE.BufferAttribute, c = this.waves.getAttribute("color") as THREE.BufferAttribute;
    const phase = elapsed / 2200, align = e.resolve;
    for (let lane = 0; lane < this.lanes; lane++) for (let i = 0; i < this.steps; i++) for (let end = 0; end < 2; end++) {
      const u = (i + end) / this.steps, at = (lane * this.steps + i) * 2 + end;
      const row = .59 + (lane - 4) * .012, wave = Math.sin(u * Math.PI * 2 + phase + lane * .31) * this.height * (.065 + lane % 3 * .012);
      const angle = (u - .5) * 1.16, radius = this.width / (2 * Math.sin(.58));
      const x = Math.sin(angle) * radius, y = this.height * row + wave, z = .025 + (Math.cos(angle) - 1) * radius;
      const widthAtHeight = Math.sin(u * Math.PI) * this.width * .21;
      p.setXYZ(at, THREE.MathUtils.lerp(x, (lane - 4) / 4 * widthAtHeight, align), THREE.MathUtils.lerp(y, this.height * u, align), z + lane * .0015);
      const glow = .25 + .7 * Math.exp(-(((u - ((phase * .32 + lane * .11) % 1)) / .15) ** 2));
      c.setXYZ(at, this.waveBaseline[at * 3] * glow, this.waveBaseline[at * 3 + 1] * glow, this.waveBaseline[at * 3 + 2] * glow);
    }
    p.needsUpdate = true; c.needsUpdate = true;
    this.waves.setDrawRange(0, Math.floor(this.lanes * this.steps * e.form) * 2);
  }
  reset(): void { this.group.visible = false; this.field.scale.set(1, 1, 1); this.glass.opacity = this.lines.opacity = this.points.opacity = this.ink.opacity = 0; }
  get inspection() {
    return { visible: this.group.visible, width: this.width, height: this.height, base: this.base, shoulderRatio: 1.3, fitScale: this.fit,
      geometryCount: this.geometries.size, materialCount: this.materials.size, textureCount: 0, drawObjects: 5,
      triangles: [...this.geometries].reduce((count, geometry) => count + (geometry.index?.count ?? 0) / 3, 0), identity: "NuTuenSai 💙" };
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.reset(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.group.removeFromParent(); }
}

/** Target remains Normal/Hologram. Projection is an ephemeral authored operation. */
export class PresenceProjectionTransition {
  private readonly normalMaterials: { material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean }[];
  private started?: number;
  private from: PresenceMode;
  private target: PresenceMode;
  private disposed = false;
  constructor(normal: THREE.Group, private readonly graph: EnergyGraphPresence, readonly projection: SpatialProjection,
    private readonly changed: () => void, initial: PresenceMode = "normal") {
    this.from = this.target = initial;
    const materials = new Set<THREE.Material>();
    normal.traverse(object => { const material = (object as THREE.Mesh).material; if (material) (Array.isArray(material) ? material : [material]).forEach(item => materials.add(item)); });
    this.normalMaterials = [...materials].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }));
  }
  start(target: PresenceMode, reduced: boolean, now = performance.now()): boolean {
    if (this.disposed || this.active || target === this.target) return false;
    this.from = this.target; this.target = target;
    if (reduced) { this.cancel(target); return true; }
    this.started = now;
    this.normalMaterials.forEach(({ material }) => { if (!material.transparent) { material.transparent = true; material.needsUpdate = true; } material.depthWrite = false; });
    this.graph.setMode(target); this.frame(now); this.changed(); return true;
  }
  frame(now: number): void {
    if (this.started === undefined) return;
    const elapsed = Math.max(0, now - this.started);
    if (elapsed >= PROJECTION_TIMING.duration) { this.cancel(this.target); return; }
    const e = projectionEnvelope(elapsed), normal = this.from === "normal" ? e.source : e.destination, graph = this.from === "hologram" ? e.source : e.destination;
    this.normalMaterials.forEach(({ material, opacity }) => { material.opacity = opacity * normal; });
    this.graph.setTransitionMix(normal > .0001, graph);
    this.projection.apply(elapsed);
  }
  cancel(target = this.target): void {
    this.started = undefined; this.target = this.from = target;
    this.normalMaterials.forEach(({ material, opacity, transparent, depthWrite }) => {
      material.opacity = opacity; material.depthWrite = depthWrite;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
    });
    this.graph.setMode(target); this.graph.clearTransitionMix(); this.projection.reset(); this.changed();
  }
  get active(): boolean { return this.started !== undefined; }
  get inspection() { return { active: this.active, from: this.from, target: this.target, elapsed: this.started === undefined ? 0 : Math.max(0, performance.now() - this.started), ...this.projection.inspection }; }
  dispose(): void { if (this.disposed) return; this.cancel(); this.disposed = true; this.projection.dispose(); }
}
