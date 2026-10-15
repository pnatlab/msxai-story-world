import * as THREE from "three";
import { CameraDirector } from "../scene/CameraDirector";
import type { CameraState } from "../world/world.schema";
import { MEMORIES, memoryAsset, type MemoryId } from "./content";
import type { NtsState } from "./visitState";
import { compactNts, TRACE_POSITIONS, type NtsComposition, type ProjectedBox } from "./composition";

interface SnapshotObject { name: string; role: string; position: { offset: number; count: number }; normal: { offset: number; count: number }; index: { offset: number; count: number }; color?: { offset: number; count: number }; }
type SavedControls = { minDistance: number; maxDistance: number; minPolarAngle: number; maxPolarAngle: number; minAzimuthAngle: number; maxAzimuthAngle: number; enablePan: boolean; enableZoom: boolean; enableRotate: boolean; };

/** One static low braid, joined to the authored scalp in its local coordinates. */
function lowBraidGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const sweep = (points: THREE.Vector3[], segments: number, sides: number, radius: (t: number) => number, flatten: number): void => {
    const curve = new THREE.CatmullRomCurve3(points);
    const base = positions.length / 3;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments, center = curve.getPoint(t), tangent = curve.getTangent(t);
      const lateral = new THREE.Vector3(1, 0, 0);
      lateral.addScaledVector(tangent, -lateral.dot(tangent)).normalize();
      const outward = new THREE.Vector3().crossVectors(tangent, lateral).normalize();
      for (let side = 0; side < sides; side++) {
        const a = side / sides * Math.PI * 2;
        const p = center.clone().addScaledVector(lateral, Math.cos(a) * radius(t)).addScaledVector(outward, Math.sin(a) * radius(t) * flatten);
        positions.push(p.x, p.y, p.z);
        if (row < segments) {
          const i = base + row * sides + side, next = base + row * sides + (side + 1) % sides;
          indices.push(i, next, i + sides, next, next + sides, i + sides);
        }
      }
    }
    for (const end of [0, segments]) {
      const center = curve.getPoint(end / segments), cap = positions.length / 3;
      positions.push(center.x, center.y, center.z);
      for (let side = 0; side < sides; side++) {
        const a = base + end * sides + side, b = base + end * sides + (side + 1) % sides;
        indices.push(cap, end ? a : b, end ? b : a);
      }
    }
  };
  // The gathering begins inside the rear scalp and closes around the braid roots.
  sweep([
    new THREE.Vector3(0, 1.575, -.043),
    new THREE.Vector3(0, 1.54, -.083),
    new THREE.Vector3(0, 1.52, -.103),
    new THREE.Vector3(0, 1.50, -.115),
  ], 20, 12, t => THREE.MathUtils.lerp(.029, .021, t), .7);
  // Wearer-left shoulder: remain behind the ear, then turn below the mask loops.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.515, -.103),
    new THREE.Vector3(.055, 1.492, -.102),
    new THREE.Vector3(.090, 1.465, -.070),
    new THREE.Vector3(.110, 1.423, -.010),
    new THREE.Vector3(.111, 1.381, .034),
    new THREE.Vector3(.108, 1.348, .069),
    new THREE.Vector3(.103, 1.306, .081),
    new THREE.Vector3(.089, 1.250, .083),
  ]);
  // Three continuous strands exchange left/right positions and alternate depth.
  // They are merged into one mesh; no detached beads, simulation or moving parts.
  for (let strand = 0; strand < 3; strand++) {
    const points = Array.from({ length: 85 }, (_, row) => {
      const t = row / 84, phase = t * Math.PI * 8 + strand * Math.PI * 2 / 3;
      const taper = THREE.MathUtils.lerp(1, .4, t);
      const center = path.getPoint(t), tangent = path.getTangent(t);
      const lateral = new THREE.Vector3(1, 0, 0);
      lateral.addScaledVector(tangent, -lateral.dot(tangent)).normalize();
      const depth = new THREE.Vector3().crossVectors(tangent, lateral).normalize();
      return center.addScaledVector(lateral, Math.sin(phase) * .019 * taper)
        .addScaledVector(depth, Math.sin(phase * 2) * .008 * taper);
    });
    sweep(points, 84, 10, t => (.0095 - .003 * t) * (t > .9 ? THREE.MathUtils.lerp(1, .22, (t - .9) / .1) : 1), .85);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** A small rounded fringe follows the forehead; its ends nest under authored hair. */
function sideFringeGeometry(support: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const samplerMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const surfaces = support.map(geometry => new THREE.Mesh(geometry, samplerMaterial));
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  const cache = new Map<string, number>();
  const surfaceZ = (x: number, y: number): number => {
    const key = `${x.toFixed(6)},${y.toFixed(6)}`;
    if (cache.has(key)) return cache.get(key)!;
    ray.set(new THREE.Vector3(x, y, .2), direction);
    const hit = ray.intersectObjects(surfaces, false)[0];
    if (!hit) throw Error("fringe surface");
    cache.set(key, hit.point.z); return hit.point.z;
  };
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.018, 1.668, 0), new THREE.Vector3(.006, 1.645, 0),
    new THREE.Vector3(-.002, 1.632, 0), new THREE.Vector3(-.015, 1.619, 0),
    new THREE.Vector3(-.035, 1.608, 0), new THREE.Vector3(-.055, 1.602, 0),
    new THREE.Vector3(-.075, 1.598, 0),
  ]);
  const positions: number[] = [], indices: number[] = [], segments = 32, sides = 12;
  try {
    for (let row = 0; row <= segments; row++) {
      const t = row / segments, center = path.getPoint(t), tangent = path.getTangent(t);
      const across = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const width = (.001 + .007 * Math.sin(Math.PI * t)) * (t > .7 ? THREE.MathUtils.lerp(1, .5, (t - .7) / .3) : 1);
      const blend = THREE.MathUtils.smoothstep(t, 0, .1) * (1 - THREE.MathUtils.smoothstep(t, .9, 1));
      for (let side = 0; side < sides; side++) {
        const a = side / sides * Math.PI * 2, p = center.clone().addScaledVector(across, Math.cos(a) * width);
        p.y = Math.max(1.596, p.y);
        p.z = surfaceZ(p.x, p.y) + .0006 + blend * .0013 + Math.sin(a) * (.00015 + blend * .00105);
        positions.push(p.x, p.y, p.z);
        if (row < segments) {
          const i = row * sides + side, next = row * sides + (side + 1) % sides;
          indices.push(i, next, i + sides, next, next + sides, i + sides);
        }
      }
    }
    for (const end of [0, segments]) {
      const center = path.getPoint(end / segments), cap = positions.length / 3;
      positions.push(center.x, center.y, surfaceZ(center.x, center.y) + .0006);
      for (let side = 0; side < sides; side++) {
        const a = end * sides + side, b = end * sides + (side + 1) % sides;
        indices.push(cap, end ? a : b, end ? b : a);
      }
    }
  } finally { samplerMaterial.dispose(); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** Open the existing eye patch and its lids, keeping the calm gaze and eye width. */
function softenEyeOpening(geometry: THREE.BufferGeometry): void {
  const original = geometry.getAttribute("position");
  const positions = new THREE.Float32BufferAttribute(new Float32Array(original.array), 3);
  for (let i = 0; i < positions.count; i++) {
    const t = THREE.MathUtils.clamp((Math.abs(positions.getX(i)) - .020) / .036, 0, 1);
    const center = 1.56925 + .0015 * t;
    const lift = .0004 * Math.sin(Math.PI * t) + .0003 * t;
    // Fuller shoulders of the aperture soften its pointed almond corners; width/gaze stay fixed.
    const rounding = 1.38 / Math.pow(Math.max(Math.sin(Math.PI * t), .12), .16);
    positions.setY(i, center + rounding * (positions.getY(i) - center) + lift);
  }
  geometry.setAttribute("position", positions); geometry.computeVertexNormals();
  if (geometry.hasAttribute("color")) {
    const colors = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
    const sclera = new THREE.Color("#d5d9d3"), iris = new THREE.Color("#5b5144");
    const rim = new THREE.Color("#35332e"), pupil = new THREE.Color("#191e20");
    for (let i = 0; i < positions.count; i++) {
      const x = Math.abs(positions.getX(i)) - .038, y = positions.getY(i) - 1.5717;
      const r = Math.hypot(x, y);
      const color = r < .0044 ? pupil : r < .0087 ? iris : r < .0095 ? rim : sclera;
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    geometry.setAttribute("color", colors);
  }
}

/** Lift/compress only the lower jaw; cheeks, upper face, width and neck are untouched. */
function shortenChin(geometry: THREE.BufferGeometry): void {
  const positions = new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").array), 3);
  const normals = new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("normal").array), 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y >= 1.495) continue;
    const t = THREE.MathUtils.clamp((y - 1.435) / .060, 0, 1);
    positions.setY(i, y + .018 * (1 - THREE.MathUtils.smoothstep(y, 1.435, 1.495)));
    // Inverse-transpose of the local Y warp preserves the authored smooth jaw normals.
    const slope = 1 - .018 * 6 * t * (1 - t) / .060;
    normal.fromBufferAttribute(normals, i); normal.y /= slope; normal.normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.setAttribute("position", positions); geometry.setAttribute("normal", normals);
}

/** Compact the existing mask vertically; ear anchors stay put while front straps follow. */
function compactMask(geometry: THREE.BufferGeometry, strap: boolean): void {
  const positions = new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").array), 3);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i), compact = 1.5038676 + .78 * (y - 1.5038676);
    const weight = strap ? THREE.MathUtils.smoothstep(positions.getZ(i), 0, .045) : 1;
    positions.setY(i, THREE.MathUtils.lerp(y, compact, weight));
  }
  geometry.setAttribute("position", positions); geometry.computeVertexNormals();
}

/** Two small static reflections follow the eye surfaces, not the camera. */
function eyeCatchlightGeometry(eyes: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], sides = 24;
  const samplerMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  try {
    for (const eye of eyes) {
      eye.computeBoundingBox();
      const centerX = eye.boundingBox!.getCenter(new THREE.Vector3()).x - .0028, centerY = 1.5755;
      const surface = new THREE.Mesh(eye, samplerMaterial), base = positions.length / 3;
      for (let i = 0; i <= sides; i++) {
        const a = (i - 1) / sides * Math.PI * 2;
        const x = centerX + (i ? Math.cos(a) * .0017 : 0), y = centerY + (i ? Math.sin(a) * .0017 : 0);
        ray.set(new THREE.Vector3(x, y, .2), direction);
        const hit = ray.intersectObject(surface)[0];
        if (!hit) throw Error("eye reflection surface");
        positions.push(x, y, hit.point.z + .00012);
        if (i) indices.push(base, base + i, base + (i % sides) + 1);
      }
    }
  } finally { samplerMaterial.dispose(); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** Bounded destination presentation. Reuses the renderer/director; no semantic controller. */
export class NtsPresentation {
  readonly group = new THREE.Group();
  readonly presence = new THREE.Group();
  private readonly panels = new Map<MemoryId, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly textures = new Map<MemoryId, THREE.Texture>();
  private readonly pending = new Set<MemoryId>();
  private memoryLifting = false;
  private imageGeneration = 0;
  private compact = false;
  private readonly wanted = new Set<MemoryId>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly savedVisibility = new Map<THREE.Object3D, boolean>();
  private savedCamera?: CameraState;
  private savedControls?: SavedControls;
  private savedPortrait = false;
  private portrait = false;
  private state?: NtsState;
  private started = 0;
  private duration = 0;
  private fromBlend = 0;
  private toBlend = 0;
  private blend = 0;
  private loaded = false;
  private loading = false;
  private failed = false;
  private disposed = false;
  private readonly abort = new AbortController();
  private readonly skyPresence = { value: 0 };
  private motionStarted = -Infinity;
  private motionUntil = 0;
  private readonly livingLines: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  private orbit?: { start: number; from: number; to: number; duration: number };
  get needsMotion(): boolean { return this.active && (performance.now() < this.motionUntil || Boolean(this.orbit)); }
  get transitioning(): boolean { return this.active && this.duration > 0 && performance.now() < this.started + this.duration; }
  constructor(private readonly scene: THREE.Scene, private readonly director: CameraDirector, private readonly changed: () => void,
    private readonly failedImage: (id: MemoryId) => void, private readonly failedPresence: () => void) {
    this.group.name = "presentation:fictional-NTS"; this.group.visible = false;
    this.group.add(this.presence); this.scene.add(this.group);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(125, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true, uniforms: { uPresence: this.skyPresence },
      vertexShader: "varying float vHeight; void main(){vHeight=position.y/125.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "varying float vHeight; uniform float uPresence; void main(){vec3 c=mix(vec3(.52,.62,.61),vec3(.12,.27,.35),smoothstep(-.12,.62,vHeight)); gl_FragColor=vec4(c,uPresence);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    }));
    sky.renderOrder = -100; this.group.add(sky);
    const shelf = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshStandardMaterial({ color: "#d3d0b9", roughness: 1, metalness: 0 }));
    shelf.position.set(0, -79, -20); this.group.add(shelf);
    const ringPoints = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-70, 15, -45), new THREE.Vector3(-8, 35, -72), new THREE.Vector3(70, 8, -60)).getPoints(100);
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: "#e4eee3", transparent: true, opacity: .19, fog: false, depthWrite: false }));
    ring.name = "NTS-distant-ring-continuation"; this.group.add(ring);
    // Thin static terrain silhouettes, not a volumetric simulation or real geography.
    for (let layer = 0; layer < 3; layer++) {
      const points: number[] = []; const indices: number[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = i / 128 * Math.PI * 2, radius = 40 + layer * 11;
        const x = -4.8 + Math.sin(a) * radius, z = 1 + Math.cos(a) * radius;
        const y = 2 + layer * .6 + Math.sin(a * 7 + layer) * 1.1 + Math.cos(a * 11) * .65;
        points.push(x, y, z, x, -20, z);
        if (i < 128) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); geo.setIndex(indices); geo.computeVertexNormals();
      this.group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ["#8ea7ad", "#b0bfba", "#c5ceca"][layer], side: THREE.DoubleSide })));
    }
    for (let i = 0; i < 3; i++) {
      const points = Array.from({ length: 61 }, (_, n) => { const a = n / 60 * Math.PI * 1.35 - .5; return new THREE.Vector3(Math.cos(a) * (5 + i * 2), 2 + Math.sin(a) * (1 + i * .5), Math.sin(a + .4) * 3 - i * 2); });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: "#c9eff0", transparent: true, opacity: .13, depthWrite: false }));
      line.rotation.y = i * .35; this.group.add(line);
      this.livingLines.push(line);
    }
    const light = new THREE.DirectionalLight("#fff2dc", 1.7); light.position.set(-5, 10, 10); light.target.position.set(0, 3, 0); this.group.add(light, light.target);
    const memoryCurve = new THREE.CatmullRomCurve3(TRACE_POSITIONS.map(p => new THREE.Vector3(p[0], p[1] - 1.05, p[2])));
    const memoryThread = new THREE.Line(new THREE.BufferGeometry().setFromPoints(memoryCurve.getPoints(96)), new THREE.LineBasicMaterial({ color: "#c1eff5", transparent: true, opacity: .13, depthWrite: false }));
    memoryThread.name = "editorial-memory-field-continuity"; this.group.add(memoryThread); this.livingLines.push(memoryThread);
    const panelGeometry = new THREE.PlaneGeometry(3.9, 5.85);
    MEMORIES.forEach((item) => {
      const panel = new THREE.Mesh(panelGeometry, new THREE.MeshBasicMaterial({ color: "#e8eee5", transparent: true, opacity: 1, side: THREE.DoubleSide, fog: false }));
      panel.name = `active-visual-memory:${item.id}`; panel.position.set(-.3, 4.7, 1.5);
      panel.userData.memoryId = item.id; panel.visible = false; this.panels.set(item.id, panel); this.group.add(panel);
    });
    this.group.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) this.geometries.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => this.materials.add(m)); });
  }
  get active(): boolean { return this.group.visible; }
  setMemoryLift(active: boolean): void {
    if (this.memoryLifting === active) return;
    this.memoryLifting = active;
    this.panels.forEach((panel, id) => { panel.visible = this.wanted.has(id) && !active; });
    this.changed();
  }
  enter(anchor: THREE.Vector3, portrait: boolean, reduced: boolean, manual: boolean): void {
    this.portrait = portrait; this.savedPortrait = portrait;
    this.compact = compactNts(window.innerWidth, window.innerHeight);
    const camera = this.director.camera; const controls = this.director.controls;
    this.savedCamera = { id: "NTS-return-context", position: camera.position.toArray() as [number, number, number], target: this.director.target.toArray() as [number, number, number], fov: camera.fov, durationMs: 650, allowManualControl: manual };
    this.savedControls = { minDistance: controls.minDistance, maxDistance: controls.maxDistance, minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle, minAzimuthAngle: controls.minAzimuthAngle, maxAzimuthAngle: controls.maxAzimuthAngle, enablePan: controls.enablePan, enableZoom: controls.enableZoom, enableRotate: controls.enableRotate };
    this.savedVisibility.clear();
    this.scene.children.forEach(object => {
      if (object === this.group || (object as THREE.Light).isLight || object.name === "environment:uranian-depth") return;
      this.savedVisibility.set(object, object.visible);
    });
    this.group.position.copy(anchor).add(new THREE.Vector3(0, -2, -14)); this.group.visible = true;
    controls.enablePan = false; controls.enableZoom = false; controls.enableRotate = false;
    this.setBlend(1, reduced ? 0 : 1600);
    this.director.camera.clearViewOffset();
    this.director.moveTo(this.arrivalCamera(reduced ? 0 : 1600), reduced);
  }
  setState(state: NtsState, reduced: boolean): void {
    const previous = this.state; this.state = state;
    if (!this.active) return;
    if (reduced && state.phase !== "returning") this.setBlend(1, 0);
    if (reduced || state.dom || state.phase !== "settled") this.motionUntil = 0;
    else if (previous?.phase !== "settled" || previous.memoryId !== state.memoryId) {
      // One quiet settling response, not a permanent animation loop or data signal.
      this.motionStarted = performance.now(); this.motionUntil = this.motionStarted + 3200;
    }
    this.loadMemories();
    if (state.phase === "settled" && !state.dom && !this.loading && !this.loaded && !this.failed) void this.loadPresence();
    this.presence.visible = this.loaded && state.phase === "settled" && !state.dom;
    // Opaque identity zone stays opaque; only supporting presence is quieter while reading.
    this.presence.traverse(object => { const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; if (mesh.material) mesh.material.emissiveIntensity = state.reading && !state.inspection ? .015 : .055; });
    if (state.phase === "settled" && (state.inspection !== previous?.inspection || state.introduction !== previous?.introduction || state.reading !== previous?.reading)) this.moveForState(reduced);
    this.changed();
  }
  beginReturn(reduced: boolean, fallbackCamera: CameraState): void {
    this.abort.abort();
    this.orbit = undefined; this.motionUntil = 0;
    if (!this.savedCamera) return;
    this.setBlend(0, reduced ? 0 : 650);
    const target = this.savedPortrait === this.portrait ? this.savedCamera : fallbackCamera;
    this.director.moveTo({ ...target, durationMs: 650, allowManualControl: false }, reduced);
  }
  finishReturn(): boolean {
    const manual = this.savedCamera?.allowManualControl ?? true;
    this.group.visible = false;
    this.savedVisibility.forEach((visible, object) => { object.visible = visible; }); this.savedVisibility.clear();
    if (this.savedControls) Object.assign(this.director.controls, this.savedControls);
    this.director.controls.enabled = manual; this.savedCamera = undefined; this.state = undefined;
    this.blend = 0; this.duration = 0;
    this.textures.forEach(texture => texture.dispose()); this.textures.clear(); this.wanted.clear();
    this.imageGeneration++; this.pending.clear();
    this.panels.forEach(panel => { panel.material.map = null; panel.material.needsUpdate = true; panel.visible = false; });
    return manual;
  }
  resize(portrait: boolean, reduced: boolean): void { this.portrait = portrait; this.compact = compactNts(window.innerWidth, window.innerHeight); if (this.active) { this.loadMemories(); this.moveForState(reduced, true); } }
  frame(now: number): number {
    const motion = now < this.motionUntil ? Math.sin(Math.PI * (now - this.motionStarted) / 3200) : 0;
    this.livingLines.forEach((line, i) => { line.material.opacity = .13 + motion * .075; line.position.y = motion * .09 * (i % 2 ? -1 : 1); });
    if (this.orbit) {
      const t = Math.min(1, (now - this.orbit.start) / this.orbit.duration);
      const yaw = THREE.MathUtils.lerp(this.orbit.from, this.orbit.to, t * t * (3 - 2 * t));
      this.director.moveTo(this.orbitCamera(yaw, 0), true);
      if (t === 1) this.orbit = undefined;
    }
    const t = this.duration ? THREE.MathUtils.clamp((now - this.started) / this.duration, 0, 1) : 1;
    this.blend = THREE.MathUtils.lerp(this.fromBlend, this.toBlend, t * t * (3 - 2 * t));
    this.skyPresence.value = this.blend;
    this.savedVisibility.forEach((visible, object) => { object.visible = this.blend < .7 && visible; });
    return this.blend;
  }
  pick(raycaster: THREE.Raycaster): "presence" | MemoryId | undefined {
    if (!this.active || this.state?.phase !== "settled" || this.state.dom) return;
    if (this.presence.visible && raycaster.intersectObject(this.presence, true).length) return "presence";
    return raycaster.intersectObjects([...this.panels.values()].filter(p => p.visible), false)[0]?.object.userData.memoryId as MemoryId | undefined;
  }
  private moveForState(reduced: boolean, immediate = false): void {
    if (this.state?.phase === "returning") return;
    const duration = reduced || immediate ? 0 : 550;
    if (this.state?.inspection) {
      const yaw = (typeof this.state.inspection === "number" ? this.state.inspection : this.state.inspection === "left" ? -90 : this.state.inspection === "right" ? 90 : 0) * Math.PI / 180;
      const local = this.director.camera.position.clone().sub(this.group.position);
      const from = Math.atan2(local.x + 4.8, local.z - 1);
      if (!duration) { this.orbit = undefined; this.director.moveTo(this.orbitCamera(yaw, 0), true); }
      else if (Math.abs(local.distanceTo(new THREE.Vector3(-4.8, 4.8, 1)) - 8) < .1) this.orbit = { start: performance.now(), from, to: yaw, duration };
      else this.director.moveTo(this.orbitCamera(yaw, duration), false);
    } else if (this.state?.introduction) {
      this.orbit = undefined;
      this.director.moveTo(this.encounterCamera(duration), reduced || immediate);
    } else if (this.state?.reading) {
      this.orbit = undefined;
      this.director.moveTo(this.compact ? this.compactReadingCamera(duration) : this.cameraState([.5, 6.8, 21], [.5, 3.5, .2], 42, duration), reduced || immediate);
    } else { this.orbit = undefined; this.director.moveTo(this.arrivalCamera(duration), reduced || immediate); }
  }
  private orbitCamera(yaw: number, duration: number): CameraState { return this.cameraState([-4.8 + Math.sin(yaw) * 8, 4.8, 1 + Math.cos(yaw) * 8], [-4.8, 4.5, 1], this.compact ? 44 : 38, duration); }
  private arrivalCamera(duration: number): CameraState { return this.compact ? this.encounterCamera(duration) : this.cameraState([0, 6.6, 21], [-.5, 3.0, .3], 42, duration); }
  private encounterCamera(duration: number): CameraState { return this.compact ? this.cameraState([-3.6, 6.0, 18], [-3.6, 4, 1], 39, duration) : this.cameraState([-2.6, 6.6, 20], [-2.6, 3.5, 1], 42, duration); }
  private compactReadingCamera(duration: number): CameraState {
    // Keep head/mask in the contextual row above the DOM reading surface.
    // Scale distance with viewport height, not face geometry or character size.
    const height = window.innerHeight, width = window.innerWidth, distance = height * .038;
    const pixelsPerUnit = height / (2 * distance * Math.tan(39 * Math.PI / 360));
    const x = -4.8 + width * .23 / pixelsPerUnit, y = 5.8 - (height / 2 - 170) / pixelsPerUnit;
    return this.cameraState([x, Math.max(3, y + 2), 1 + distance], [x, y, 1], 39, duration);
  }
  private cameraState(position: [number, number, number], target: [number, number, number], fov: number, durationMs: number): CameraState {
    const p = new THREE.Vector3(...position).add(this.group.position); const t = new THREE.Vector3(...target).add(this.group.position);
    return { id: "private-NTS-camera", position: p.toArray() as [number, number, number], target: t.toArray() as [number, number, number], fov, durationMs, allowManualControl: false };
  }
  private setBlend(to: number, duration: number): void { this.fromBlend = this.blend; this.toBlend = to; this.started = performance.now(); this.duration = duration; }
  private loadMemories(): void {
    if (!this.state) return;
    const next = this.state.reading && !this.state.inspection && !this.state.introduction && !this.compact && !this.state.dom ? this.state.memoryId : undefined;
    if ([...this.wanted][0] !== next) { this.imageGeneration++; this.pending.clear(); }
    const generation = this.imageGeneration;
    this.wanted.clear();
    if (next) this.wanted.add(next);
    this.textures.forEach((texture, id) => { if (!this.wanted.has(id)) { texture.dispose(); this.textures.delete(id); this.panels.get(id)!.material.map = null; } });
    this.panels.forEach((panel, id) => {
      panel.visible = this.wanted.has(id) && !this.memoryLifting;
      panel.material.opacity = 1;
      panel.material.depthWrite = id === this.state!.memoryId;
      panel.renderOrder = id === this.state!.memoryId ? 2 : 1;
      if (!this.wanted.has(id) || this.textures.has(id) || this.pending.has(id)) return;
      this.pending.add(id);
      new THREE.TextureLoader().load(memoryAsset(id), texture => {
        if (this.disposed || generation !== this.imageGeneration || !this.active || !this.wanted.has(id)) { texture.dispose(); return; }
        this.pending.delete(id);
        texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
        this.textures.set(id, texture); panel.material.map = texture; panel.material.needsUpdate = true; this.changed();
      }, undefined, () => { if (!this.disposed && generation === this.imageGeneration) { this.pending.delete(id); this.failedImage(id); } });
    });
  }
  private async loadPresence(): Promise<void> {
    this.loading = true;
    try {
      const base = `${import.meta.env.BASE_URL}nts/`;
      const infoResponse = await fetch(`${base}presence-study.json`, { signal: this.abort.signal }); if (!infoResponse.ok) throw Error("presence snapshot");
      const info = await infoResponse.json() as { objects: SnapshotObject[] };
      const response = await fetch(`${base}presence-study.bin`, { signal: this.abort.signal }); if (!response.ok) throw Error("presence mesh");
      const buffer = await response.arrayBuffer(); if (this.disposed || this.abort.signal.aborted) return;
      const palette: Record<string, string> = { skin: "#ecd6c6", hair: "#15191e", brow: "#332a29", lid: "#94776c", mask: "#eaf2f4", print: "#6d7b86", loop: "#cddce0", body: "#8ea7ad", eye: "#ffffff" };
      const shared = new Map<string, THREE.MeshStandardMaterial>();
      const fringeSupport: THREE.BufferGeometry[] = [];
      const eyeSurfaces: THREE.BufferGeometry[] = [];
      for (const item of info.objects) {
        // Keep binary assets unchanged; bounded face refinements use cloned attributes.
        if (item.name === "NTS_2C_Hair_LowPonytail") continue;
        const geo = new THREE.BufferGeometry();
        for (const key of ["position", "normal", "color"] as const) if (item[key]) geo.setAttribute(key, new THREE.BufferAttribute(new Float32Array(buffer, item[key]!.offset, item[key]!.count), 3));
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, item.index.offset, item.index.count), 1)); this.geometries.add(geo);
        if (/^NTS_2C_(Eye|Lid_Upper|Lid_Lower)_[RL]$/.test(item.name)) softenEyeOpening(geo);
        if (item.name === "NTS_2C_Head_OriginalStylized") shortenChin(geo);
        if (item.role === "eye") eyeSurfaces.push(geo);
        if (["mask", "loop", "print"].includes(item.role)) compactMask(geo, item.role === "loop");
        if (item.name === "NTS_2C_Head_OriginalStylized") fringeSupport.push(geo);
        const upperEye = /^NTS_2C_Lid_Upper_[RL]$/.test(item.name), materialKey = upperEye ? "upper-eye" : item.role;
        let material = shared.get(materialKey);
        if (!material) {
          material = new THREE.MeshStandardMaterial({ color: upperEye ? "#675a52" : palette[item.role], roughness: item.role === "hair" ? .94 : .82, emissive: palette[item.role], emissiveIntensity: .055, vertexColors: item.role === "eye", transparent: item.role === "body", depthWrite: true });
          const role = item.role;
          material.onBeforeCompile = shader => {
            shader.vertexShader = "varying float vStudyHeight;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvStudyHeight = position.y;");
            shader.fragmentShader = "varying float vStudyHeight;\n" + shader.fragmentShader;
            if (role === "body") shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= smoothstep(.99, 1.16, vStudyHeight);");
            if (["body", "skin", "hair"].includes(role)) shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.08,.18,.22) * pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),2.8);");
          };
          material.customProgramCacheKey = () => `private-NTS-study-${role}`;
          shared.set(materialKey, material); this.materials.add(material);
        }
        const mesh = new THREE.Mesh(geo, material); mesh.name = item.name; if (item.role === "body") mesh.renderOrder = 1; this.presence.add(mesh);
      }
      const hairGeometry = lowBraidGeometry(); this.geometries.add(hairGeometry);
      const braid = new THREE.Mesh(hairGeometry, shared.get("hair")!); braid.name = "NTS_Hair_LowSingleBraid"; this.presence.add(braid);
      const fringeGeometry = sideFringeGeometry(fringeSupport); this.geometries.add(fringeGeometry);
      const fringe = new THREE.Mesh(fringeGeometry, shared.get("hair")!); fringe.name = "NTS_Hair_SoftSideFringe"; this.presence.add(fringe);
      const catchlightGeometry = eyeCatchlightGeometry(eyeSurfaces); this.geometries.add(catchlightGeometry);
      const catchlightMaterial = new THREE.MeshBasicMaterial({ color: "#f5f7f1" }); this.materials.add(catchlightMaterial);
      const catchlights = new THREE.Mesh(catchlightGeometry, catchlightMaterial); catchlights.name = "NTS_Eyes_StaticCatchlights"; this.presence.add(catchlights);
      this.presence.scale.setScalar(6); this.presence.position.set(-4.8, -4.6, 1);
      this.loaded = true; this.presence.visible = this.active && this.state?.phase === "settled" && !this.state.dom; this.changed();
    } catch { if (!this.disposed && !this.abort.signal.aborted) { this.failed = true; this.failedPresence(); } }
    finally { this.loading = false; }
  }
  get inspection() {
    const point = new THREE.Vector3(-4.8, 4.6, 1).add(this.group.position).project(this.director.camera);
    return { active: this.active, loaded: this.loaded, failed: this.failed, blend: this.blend, textureCount: this.textures.size, visibleMemories: [...this.panels].filter(([, panel]) => panel.visible).map(([id]) => id), visibleTraces: this.active ? MEMORIES.map(item => item.id) : [], presenceMeshCount: this.presence.children.length, savedCamera: Boolean(this.savedCamera), presenceNdc: { x: point.x, y: point.y }, composition: this.project(window.innerWidth, window.innerHeight) };
  }
  project(width: number, height: number): NtsComposition {
    const box = (center: readonly number[], w: number, h: number): ProjectedBox => {
      const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, y]) => new THREE.Vector3(center[0] + x * w / 2, center[1] + y * h / 2, center[2]).add(this.group.position).project(this.director.camera));
      const xs = corners.map(p => (p.x + 1) * width / 2), ys = corners.map(p => (1 - p.y) * height / 2);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), visible: this.active && corners.some(p => p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2) };
    };
    return { image: box([-.3, 4.7, 1.5], 3.9, 5.85), narrative: box([4.25, 4.7, 1.5], 4.5, 5.85), presence: box([-4.8, 3.9, 1], 2.1, 3.8), voice: box([-1.35, 4.7, 1], 4.2, 3.9), controls: box([-4.8, 1.9, 1], 4.1, .75), traces: Object.fromEntries(MEMORIES.map((item, index) => [item.id, box(TRACE_POSITIONS[index], 1.2, 1.8)])) as NtsComposition["traces"] };
  }
  dispose(): void { this.disposed = true; this.abort.abort(); this.textures.forEach(t => t.dispose()); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.group.removeFromParent(); this.savedVisibility.clear(); }
}
