import * as THREE from "three";

export const EXPRESSION_TIMING = { close: 135, closed: 40, reopen: 205, smileIn: 650, smileHold: 800, smileOut: 1050, gaps: [8400, 12700, 10300, 16100] } as const;
const ease = (t: number): number => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export function expressionEnvelope(kind: "blink" | "smile", elapsed: number): number {
  const [enter, hold, leave] = kind === "blink" ? [EXPRESSION_TIMING.close, EXPRESSION_TIMING.closed, EXPRESSION_TIMING.reopen]
    : [EXPRESSION_TIMING.smileIn, EXPRESSION_TIMING.smileHold, EXPRESSION_TIMING.smileOut];
  if (elapsed < enter) return ease(elapsed / enter);
  if (elapsed < enter + hold) return 1;
  return 1 - ease((elapsed - enter - hold) / leave);
}
const duration = (kind: "blink" | "smile"): number => kind === "blink"
  ? EXPRESSION_TIMING.close + EXPRESSION_TIMING.closed + EXPRESSION_TIMING.reopen
  : EXPRESSION_TIMING.smileIn + EXPRESSION_TIMING.smileHold + EXPRESSION_TIMING.smileOut;
type Mesh = THREE.Mesh<THREE.BufferGeometry>;
type Snapshot = { mesh: Mesh; position: Float32Array; normal: Float32Array; color?: Float32Array; visible: boolean };
const capture = (mesh: Mesh): Snapshot => ({ mesh, position: new Float32Array(mesh.geometry.getAttribute("position").array),
  normal: new Float32Array(mesh.geometry.getAttribute("normal").array), color: mesh.geometry.hasAttribute("color") ? new Float32Array(mesh.geometry.getAttribute("color").array) : undefined, visible: mesh.visible });

/** Cached neutral eye surface. Grid resampling clips aperture without scaling the iris. */
class EyeSurface {
  readonly base: Snapshot;
  readonly headZ = new Float32Array(101 * 9);
  readonly lower = new Float64Array(101);
  readonly upper = new Float64Array(101);
  readonly neutralLower = new Float64Array(101);
  readonly neutralUpper = new Float64Array(101);
  constructor(mesh: Mesh, head: Mesh) {
    this.base = capture(mesh);
    if (this.base.position.length !== 43 * 101 * 3) throw Error("H.2 requires the reviewed eye grid");
    const ray = new THREE.Raycaster(), origin = new THREE.Vector3(), direction = new THREE.Vector3(0, 0, -1);
    for (let col = 0; col <= 100; col++) {
      const x = this.base.position[col * 3], lo = this.base.position[col * 3 + 1], hi = this.base.position[(42 * 101 + col) * 3 + 1];
      this.neutralLower[col] = lo; this.neutralUpper[col] = hi;
      for (let row = 0; row <= 8; row++) {
        origin.set(x, THREE.MathUtils.lerp(lo, hi, row / 8), .2); ray.set(origin, direction);
        const hit = ray.intersectObject(head, false)[0];
        if (!hit) throw Error("H.2 head support surface");
        this.headZ[col * 9 + row] = hit.point.z;
      }
    }
  }
  private columnZ(col: number, y: number, head: boolean): number {
    const p = this.base.position, lo = p[col * 3 + 1], hi = p[(42 * 101 + col) * 3 + 1];
    if (hi - lo < .000001) return head ? this.headZ[col * 9] : p[col * 3 + 2];
    if (head) {
      const r = THREE.MathUtils.clamp((y - lo) / (hi - lo) * 8, 0, 8), a = Math.min(7, Math.floor(r));
      return THREE.MathUtils.lerp(this.headZ[col * 9 + a], this.headZ[col * 9 + a + 1], r - a);
    }
    let a = 0, b = 42;
    while (b - a > 1) { const mid = (a + b) >> 1; if (p[(mid * 101 + col) * 3 + 1] < y) a = mid; else b = mid; }
    const ia = (a * 101 + col) * 3, ib = (b * 101 + col) * 3;
    return THREE.MathUtils.lerp(p[ia + 2], p[ib + 2], THREE.MathUtils.clamp((y - p[ia + 1]) / Math.max(.0000001, p[ib + 1] - p[ia + 1]), 0, 1));
  }
  at(values: Float64Array, x: number): number {
    const t = THREE.MathUtils.clamp((Math.abs(x) - .020) / .036 * 100, 0, 100), col = Math.min(99, Math.floor(t));
    return THREE.MathUtils.lerp(values[col], values[col + 1], t - col);
  }
  z(x: number, y: number, blink = 0): number {
    const t = THREE.MathUtils.clamp((Math.abs(x) - .020) / .036 * 100, 0, 100), col = Math.min(99, Math.floor(t));
    const a = THREE.MathUtils.lerp(this.columnZ(col, y, false), this.columnZ(col, y, true), blink);
    const b = THREE.MathUtils.lerp(this.columnZ(col + 1, y, false), this.columnZ(col + 1, y, true), blink);
    return THREE.MathUtils.lerp(a, b, t - col) + blink * .00012;
  }
  setBounds(blink: number, smile: number): void {
    const p = this.base.position;
    for (let col = 0; col <= 100; col++) {
      const lo = p[col * 3 + 1], hi = p[(42 * 101 + col) * 3 + 1], shape = Math.pow(Math.sin(Math.PI * col / 100), .8);
      const seam = lo + (hi - lo) * .32;
      this.lower[col] = THREE.MathUtils.lerp(lo + smile * .0018 * shape, seam, blink);
      this.upper[col] = THREE.MathUtils.lerp(hi - smile * .00055 * shape, seam, blink);
    }
  }
}

/** Reversible presentation deformation only; never touches head, eyebrows or transforms. */
export class MicroExpressionGeometry {
  private readonly eyes: EyeSurface[];
  private readonly lids: { base: Snapshot; eye: EyeSurface; upper: boolean }[];
  private readonly reflection: Snapshot;
  private readonly snapshots: Snapshot[];
  private readonly palette = ["#d5d9d3", "#5b5144", "#35332e", "#191e20"].map(c => new THREE.Color(c));
  private dirty = false;
  blink = 0;
  smile = 0;
  constructor(meshes: readonly Mesh[]) {
    const find = (name: string): Mesh => { const mesh = meshes.find(m => m.name === name); if (!mesh) throw Error(`H.2 missing ${name}`); return mesh; };
    const head = new THREE.Mesh(find("NTS_2C_Head_OriginalStylized").geometry, find("NTS_2C_Head_OriginalStylized").material);
    this.eyes = ["R", "L"].map(side => new EyeSurface(find(`NTS_2C_Eye_${side}`), head));
    this.lids = ["R", "L"].flatMap((side, i) => [true, false].map(upper => ({ base: capture(find(`NTS_2C_Lid_${upper ? "Upper" : "Lower"}_${side}`)), eye: this.eyes[i], upper })));
    const definition = capture(find("NTS_Beauty_SoftRose_UpperDefinition"));
    this.reflection = capture(find("NTS_Eyes_StaticCatchlights"));
    this.snapshots = [...this.eyes.map(e => e.base), ...this.lids.map(l => l.base), definition, this.reflection];
    for (const s of this.snapshots) for (const attribute of ["position", "normal", "color"]) if (s.mesh.geometry.hasAttribute(attribute)) (s.mesh.geometry.getAttribute(attribute) as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  }
  apply(blink: number, smile: number): void {
    blink = Number.isFinite(blink) ? THREE.MathUtils.clamp(blink, 0, 1) : 0;
    smile = Number.isFinite(smile) ? THREE.MathUtils.clamp(smile, 0, 1) : 0;
    this.blink = blink; this.smile = smile;
    if (!blink && !smile) { this.restore(); return; }
    this.dirty = true;
    for (const eye of this.eyes) {
      eye.setBounds(blink, smile);
      const { mesh, position: p } = eye.base, geometry = mesh.geometry;
      const positions = geometry.getAttribute("position"), colors = geometry.getAttribute("color");
      mesh.visible = blink < .999;
      for (let i = 0; i < positions.count; i++) {
        const col = i % 101, lo = p[col * 3 + 1], hi = p[(42 * 101 + col) * 3 + 1];
        const x = p[i * 3], v = hi - lo > .000001 ? (p[i * 3 + 1] - lo) / (hi - lo) : .5;
        const y = THREE.MathUtils.lerp(eye.lower[col], eye.upper[col], v);
        positions.setXYZ(i, x, y, eye.z(x, y, blink));
        const r = Math.hypot(Math.abs(x) - .038, y - 1.5717), color = this.palette[r < .0044 ? 3 : r < .0087 ? 1 : r < .0095 ? 2 : 0];
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      positions.needsUpdate = true; colors.needsUpdate = true; geometry.computeVertexNormals();
    }
    const moveContour = (base: Snapshot, upper: boolean): void => {
      const positions = base.mesh.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = base.position[i * 3], y0 = base.position[i * 3 + 1], eye = this.eyes[x < 0 ? 0 : 1];
        const edge = eye.at(upper ? eye.neutralUpper : eye.neutralLower, x);
        const t = THREE.MathUtils.clamp((Math.abs(x) - .020) / .036, 0, 1);
        const taper = THREE.MathUtils.lerp(1, .2 + .8 * Math.pow(Math.sin(Math.PI * t), .4), blink);
        const y = eye.at(upper ? eye.upper : eye.lower, x) + (y0 - edge) * taper;
        const offset = base.position[i * 3 + 2] - eye.z(x, y0);
        positions.setXYZ(i, x, y, eye.z(x, y, blink) + offset * taper);
      }
      positions.needsUpdate = true; base.mesh.geometry.computeVertexNormals();
    };
    for (const lid of this.lids) moveContour(lid.base, lid.upper);
    moveContour(this.snapshots[this.snapshots.length - 2], true);
    const p = this.reflection.position, positions = this.reflection.mesh.geometry.getAttribute("position");
    let visible = true;
    for (let i = 0; i < positions.count; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], eye = this.eyes[x < 0 ? 0 : 1];
      if (y < eye.at(eye.lower, x) || y > eye.at(eye.upper, x)) visible = false;
      positions.setXYZ(i, x, y, eye.z(x, y, blink) + .00012);
    }
    positions.needsUpdate = true; this.reflection.mesh.visible = visible && blink < .999;
  }
  private restore(): void {
    if (!this.dirty) return;
    for (const s of this.snapshots) {
      for (const [key, value] of [["position", s.position], ["normal", s.normal], ["color", s.color]] as const) {
        if (!value) continue;
        const attribute = s.mesh.geometry.getAttribute(key); (attribute.array as Float32Array).set(value); attribute.needsUpdate = true;
      }
      s.mesh.visible = s.visible;
    }
    this.dirty = false;
  }
  get neutralExact(): boolean {
    return !this.blink && !this.smile && this.snapshots.every(s => s.mesh.visible === s.visible &&
      ([['position', s.position], ['normal', s.normal], ['color', s.color]] as const).every(([key, base]) => !base ||
        base.every((value, i) => s.mesh.geometry.getAttribute(key).array[i] === value)));
  }
}

/** Local optional prototype; the approved eye envelope remains exactly 2500 ms. */
export const HEAD_TILT_GESTURE = { degrees: -3, lead: 200, enter: 700, returnDelay: 100, tail: 200 } as const;
export function headTiltEnvelope(elapsed: number): number {
  const returnAt = HEAD_TILT_GESTURE.lead + EXPRESSION_TIMING.smileIn + EXPRESSION_TIMING.smileHold + HEAD_TILT_GESTURE.returnDelay;
  const end = HEAD_TILT_GESTURE.lead + duration("smile") + HEAD_TILT_GESTURE.tail;
  return elapsed < returnAt ? ease(elapsed / HEAD_TILT_GESTURE.enter) : 1 - ease((elapsed - returnAt) / (end - returnAt));
}

/** One shared neck pivot for the existing flat head assembly; no vertex edits or new scene nodes. */
export class AuthoredHeadTilt {
  private readonly pivot = new THREE.Vector3(0, 1.46, 0);
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly offset = new THREE.Quaternion();
  private readonly bases: { mesh: Mesh; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }[];
  degrees = 0;
  constructor(meshes: readonly Mesh[]) {
    this.bases = meshes.map(mesh => ({ mesh, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone() }));
  }
  begin(): void {
    this.restore();
    for (const b of this.bases) { b.position.copy(b.mesh.position); b.quaternion.copy(b.mesh.quaternion); b.scale.copy(b.mesh.scale); }
  }
  apply(value: number): void {
    if (!value) { this.restore(); return; }
    this.degrees = HEAD_TILT_GESTURE.degrees * value;
    this.offset.setFromAxisAngle(this.axis, THREE.MathUtils.degToRad(this.degrees));
    for (const b of this.bases) {
      b.mesh.position.copy(b.position).sub(this.pivot).applyQuaternion(this.offset).add(this.pivot);
      b.mesh.quaternion.copy(this.offset).multiply(b.quaternion);
    }
  }
  restore(): void {
    if (!this.degrees) return;
    for (const b of this.bases) { b.mesh.position.copy(b.position); b.mesh.quaternion.copy(b.quaternion); b.mesh.scale.copy(b.scale); }
    this.degrees = 0;
  }
  get neutralExact(): boolean { return this.degrees === 0 && this.bases.every(b => b.mesh.position.equals(b.position) && b.mesh.quaternion.equals(b.quaternion) && b.mesh.scale.equals(b.scale)); }
}

type Context = { eligible: boolean; idle: boolean };
/** One sparse timer wakes the existing renderer; frames run only for a bounded event. */
export class PresenceExpressions {
  private readonly geometry: MicroExpressionGeometry;
  private timer?: ReturnType<typeof setTimeout>;
  private animation?: { kind: "blink" | "smile"; start: number };
  private context: Context = { eligible: false, idle: false };
  private smileQueued = false;
  private gap = 0;
  private disposed = false;
  constructor(meshes: readonly Mesh[], private readonly changed: () => void, private readonly headTilt?: AuthoredHeadTilt) {
    this.geometry = new MicroExpressionGeometry(meshes);
  }
  setContext(context: Context): void {
    this.context = context;
    if (!context.eligible || (!context.idle && this.animation?.kind === "blink")) this.reset();
    else if (!context.idle) this.cancelTimer();
    this.arm();
  }
  private cancelTimer(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; }
  private reset(): void { this.cancelTimer(); this.animation = undefined; this.smileQueued = false; this.geometry.apply(0, 0); this.headTilt?.restore(); }
  // The presentation's following context refresh owns any rescheduling.
  cancel(): void { this.reset(); }
  private arm(): void {
    if (this.disposed || !this.context.eligible || !this.context.idle || this.animation || this.timer !== undefined) return;
    this.timer = setTimeout(() => { this.timer = undefined; if (this.context.eligible && this.context.idle) this.play("blink"); }, EXPRESSION_TIMING.gaps[this.gap++ % EXPRESSION_TIMING.gaps.length]);
  }
  private play(kind: "blink" | "smile"): void {
    if (kind === "smile") this.headTilt?.begin();
    this.cancelTimer(); this.animation = { kind, start: performance.now() }; this.changed();
  }
  get canSmile(): boolean { return !this.disposed && this.context.eligible && !this.smileQueued && this.animation?.kind !== "smile"; }
  smile(): boolean {
    if (!this.canSmile) return false;
    // Finish the reviewed blink before one queued smile; never restart or stack events.
    if (this.animation?.kind === "blink") this.smileQueued = true;
    else this.play("smile");
    return true;
  }
  frame(now: number): void {
    if (!this.animation) return;
    const { kind, start } = this.animation, elapsed = now - start;
    const lead = kind === "smile" && this.headTilt ? HEAD_TILT_GESTURE.lead : 0;
    const tail = kind === "smile" && this.headTilt ? HEAD_TILT_GESTURE.tail : 0;
    if (elapsed >= duration(kind) + lead + tail) {
      this.animation = undefined; this.geometry.apply(0, 0); this.headTilt?.restore();
      if (this.smileQueued) { this.smileQueued = false; this.play("smile"); }
      else this.arm();
      return;
    }
    const value = expressionEnvelope(kind, elapsed - lead);
    this.geometry.apply(kind === "blink" ? value : 0, kind === "smile" ? value : 0);
    if (kind === "smile") this.headTilt?.apply(headTiltEnvelope(elapsed));
  }
  get animating(): boolean { return Boolean(this.animation); }
  get inspection() { return { enabled: this.context.eligible, timerPending: this.timer !== undefined, animating: this.animating, kind: this.animation?.kind, smileQueued: this.smileQueued, blink: this.geometry.blink, smile: this.geometry.smile, tiltDegrees: this.headTilt?.degrees ?? 0, headNeutralExact: this.headTilt?.neutralExact ?? true, neutralExact: this.geometry.neutralExact && (this.headTilt?.neutralExact ?? true) }; }
  dispose(): void { this.disposed = true; this.reset(); }
}
