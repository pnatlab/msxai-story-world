import * as THREE from "three";
import { CameraDirector } from "../scene/CameraDirector";
import type { CameraState } from "../world/world.schema";
import { MEMORIES, memoryAsset, type MemoryId } from "./content";
import type { NtsState } from "./visitState";
import { compactNts, TRACE_POSITIONS, type NtsComposition, type ProjectedBox } from "./composition";

interface SnapshotObject { name: string; role: string; position: { offset: number; count: number }; normal: { offset: number; count: number }; index: { offset: number; count: number }; color?: { offset: number; count: number }; }
type SavedControls = { minDistance: number; maxDistance: number; minPolarAngle: number; maxPolarAngle: number; minAzimuthAngle: number; maxAzimuthAngle: number; enablePan: boolean; enableZoom: boolean; enableRotate: boolean; };

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
      const palette: Record<string, string> = { skin: "#ecd6c6", hair: "#15191e", brow: "#332a29", lid: "#94776c", mask: "#eaf2f4", print: "#6d7b86", loop: "#cddce0", body: "#151c23", eye: "#ffffff" };
      const shared = new Map<string, THREE.MeshStandardMaterial>();
      for (const item of info.objects) {
        const geo = new THREE.BufferGeometry();
        for (const key of ["position", "normal", "color"] as const) if (item[key]) geo.setAttribute(key, new THREE.BufferAttribute(new Float32Array(buffer, item[key]!.offset, item[key]!.count), 3));
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, item.index.offset, item.index.count), 1)); this.geometries.add(geo);
        let material = shared.get(item.role);
        if (!material) {
          material = new THREE.MeshStandardMaterial({ color: palette[item.role], roughness: .82, emissive: palette[item.role], emissiveIntensity: .055, vertexColors: item.role === "eye", transparent: item.role === "body", depthWrite: true });
          const role = item.role;
          material.onBeforeCompile = shader => {
            shader.vertexShader = "varying float vStudyHeight;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvStudyHeight = position.y;");
            shader.fragmentShader = "varying float vStudyHeight;\n" + shader.fragmentShader;
            if (role === "body") shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= smoothstep(.99, 1.16, vStudyHeight);");
            if (["body", "skin", "hair"].includes(role)) shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.08,.18,.22) * pow(1.0-abs(dot(normalize(normal),normalize(vViewPosition))),2.8);");
          };
          material.customProgramCacheKey = () => `private-NTS-study-${role}`;
          shared.set(role, material); this.materials.add(material);
        }
        const mesh = new THREE.Mesh(geo, material); mesh.name = item.name; if (item.role === "body") mesh.renderOrder = 1; this.presence.add(mesh);
      }
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
