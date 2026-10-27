import * as THREE from "three";
import type { PresenceMode } from "./appearance";

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
type Node = { point: THREE.Vector3; normal: THREE.Vector3; color: THREE.Color; size: number; strength: number };
type PathRange = { start: number; segments: number };
type Field = { nodes: Node[]; links: number[]; paths: number[]; pathColors: number[]; pulsePaths: PathRange[] };
const cyan = new THREE.Color("#63d7ff"), lavender = new THREE.Color("#b49aff");
const fraction = (n: number): number => n - Math.floor(n);
const field = (): Field => ({ nodes: [], links: [], paths: [], pathColors: [], pulsePaths: [] });

export const ENERGY_PULSE_TIMING = { duration: 2400, gaps: [13600, 18700, 15400, 21100] } as const;
type PulseSurface = { colors: THREE.BufferAttribute; baseline: Float32Array; paths: PathRange[] };

/** One sparse authored accent on existing paths; no geometry or shader-time loop. */
export class StructuralEnergyPulse {
  private timer?: ReturnType<typeof setTimeout>;
  private start?: number;
  private eligible = false;
  private gap = 0;
  private disposed = false;
  constructor(private readonly surfaces: readonly PulseSurface[], private readonly changed: () => void) {}
  setEligible(eligible: boolean): void {
    this.eligible = eligible && !this.disposed;
    if (!this.eligible) this.cancel();
    else this.arm();
  }
  private arm(): void {
    if (!this.eligible || this.animating || this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.eligible || this.disposed) return;
      this.start = performance.now(); this.changed();
    }, ENERGY_PULSE_TIMING.gaps[this.gap++ % ENERGY_PULSE_TIMING.gaps.length]);
  }
  private restore(): void {
    for (const surface of this.surfaces) {
      (surface.colors.array as Float32Array).set(surface.baseline); surface.colors.needsUpdate = true;
    }
  }
  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.animating) { this.start = undefined; this.restore(); this.changed(); }
  }
  frame(now: number): void {
    if (this.start === undefined) return;
    const progress = Math.max(0, (now - this.start) / ENERGY_PULSE_TIMING.duration);
    if (progress >= 1) { this.start = undefined; this.restore(); this.arm(); return; }
    const envelope = Math.sin(Math.PI * progress) ** 2;
    let lane = 0;
    for (const surface of this.surfaces) {
      const colors = surface.colors.array as Float32Array;
      for (const path of surface.paths) {
        const center = progress * 1.5 - .2 - lane++ * .05;
        for (let segment = 0; segment < path.segments; segment++) {
          const distance = (segment / (path.segments - 1) - center) / .11;
          const gain = 1 + 2.2 * envelope * Math.exp(-distance * distance);
          for (let k = 0; k < 6; k++) {
            const index = (path.start + segment) * 6 + k; colors[index] = surface.baseline[index] * gain;
          }
        }
      }
      surface.colors.needsUpdate = true;
    }
  }
  get animating(): boolean { return this.start !== undefined; }
  get inspection() { return { eligible: this.eligible, timerPending: this.timer !== undefined, animating: this.animating,
    pathCount: this.surfaces.reduce((count, surface) => count + surface.paths.length, 0),
    baselineExact: this.surfaces.every(surface => surface.colors.array.every((value, i) => value === surface.baseline[i])) }; }
  dispose(): void { this.disposed = true; this.setEligible(false); }
}

/** Symbolic surface constellation, registered to the canonical model, not its mesh topology. */
export class EnergyGraphPresence {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  readonly pulse: StructuralEnergyPulse;
  private readonly originals: { mesh: Mesh; layers: number }[];
  private readonly normalMaterials: Set<THREE.Material>;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly pointsMaterial: THREE.ShaderMaterial;
  private readonly presentationOpacities = new Map<THREE.Material, number>();
  private readonly drawRanges: { geometry: THREE.BufferGeometry; start: number; count: number; vertices: number; paired: boolean }[] = [];
  private transitionWeight?: number;
  private contextOpacity = 1;
  private mode: PresenceMode = "normal";
  private available = true;
  private nodeCount = 0;
  private connectionCount = 0;
  private pathSegments = 0;
  private drawObjects = 0;
  private disposed = false;
  constructor(meshes: readonly Mesh[], roles: ReadonlyMap<THREE.Material, string>, changed: () => void = () => {}) {
    this.group.name = "NTS-symbolic-energy-graph"; this.group.visible = false;
    this.head.name = "NTS-energy-head"; this.group.add(this.head);
    this.originals = meshes.map(mesh => ({ mesh, layers: mesh.layers.mask }));
    this.normalMaterials = new Set(meshes.map(mesh => mesh.material));
    this.pointsMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      uniforms: { uHeight: { value: 900 }, uPresentationOpacity: { value: 1 }, uContextPointScale: { value: 1 } },
      vertexShader: `attribute float aSize; attribute float aStrength; attribute vec3 color;
        varying vec3 vColor; varying float vStrength; uniform float uHeight; uniform float uContextPointScale;
        void main(){
          vec4 view = modelViewMatrix * vec4(position,1.0);
          float edge = pow(1.0-abs(dot(normalize(normalMatrix*normal),normalize(-view.xyz))),2.0);
          vColor = mix(color,vec3(.78,.94,1.0),edge*.12); vStrength = aStrength*(.65+edge*.55);
          gl_PointSize=clamp(aSize*uHeight*projectionMatrix[1][1]*length(modelMatrix[0].xyz)/max(1.0,-view.z),2.2,21.0)*uContextPointScale;
          gl_Position=projectionMatrix*view;
        }`,
      fragmentShader: `varying vec3 vColor; varying float vStrength; uniform float uPresentationOpacity;
        void main(){
          float radius=length(gl_PointCoord-vec2(.5))*2.0; if(radius>1.0)discard;
          float core=exp(-radius*radius*10.0), halo=pow(1.0-radius,2.0)*.24;
          gl_FragColor=vec4(mix(vColor,vec3(1.0),core*.25),(core+halo)*vStrength*uPresentationOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const filaments = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .075, depthWrite: false, blending: THREE.AdditiveBlending });
    const structure = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .34, depthWrite: false, blending: THREE.AdditiveBlending });
    this.materials.add(this.pointsMaterial); this.materials.add(filaments); this.materials.add(structure);
    const body = field(), head = field();
    meshes.forEach((mesh, index) => {
      const role = roles.get(mesh.material), name = mesh.name;
      const budget = role === "body" ? 1250 : name.includes("Head_Original") ? 420 : name.includes("Neck_Continuous") ? 100
        : name.includes("SoftRomanticBun") ? 280 : name.includes("SweptCap") ? 260 : role === "hair" ? 80
        : role === "mask" ? 180 : /^NTS_2C_Ear_[RL]$/.test(name) ? 24 : 0;
      if (budget) sampleSurface(mesh.geometry, budget, index + 1, role === "body" || name.includes("Neck_Continuous") ? body : head);
      if (role === "body") traceMeridians(mesh.geometry, body, 1.075, 1.415, [0, Math.PI / 2]);
      if (name.includes("Head_Original")) traceMeridians(mesh.geometry, head, 1.455, 1.675, [Math.PI / 2]);
      if (role === "mask") {
        const boundary = new THREE.EdgesGeometry(mesh.geometry, 60), p = boundary.getAttribute("position");
        for (let i = 0; i < p.count; i += 2) addSegment(head, new THREE.Vector3().fromBufferAttribute(p, i), new THREE.Vector3().fromBufferAttribute(p, i + 1), cyan, .95);
        boundary.dispose();
      }
      if (role === "eye") {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!, center = box.getCenter(new THREE.Vector3()); center.z = box.max.z + .001;
        const points = Array.from({ length: 25 }, (_, i) => center.clone().add(new THREE.Vector3(Math.cos(i / 24 * Math.PI * 2) * .012, Math.sin(i / 24 * Math.PI * 2) * .005, 0)));
        for (let i = 1; i < points.length; i++) addSegment(head, points[i - 1], points[i], lavender, .8);
        head.nodes.push({ point: center, normal: new THREE.Vector3(0, 0, 1), color: lavender.clone(), size: .004, strength: .8 });
      }
    });
    const pulseSurfaces: PulseSurface[] = [];
    for (const [data, parent] of [[body, this.group], [head, this.head]] as const) {
      connect(data); energyArcs(data);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.nodes.flatMap(n => n.point.toArray()), 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.nodes.flatMap(n => n.normal.toArray()), 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.nodes.flatMap(n => n.color.toArray()), 3));
      geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(data.nodes.map(n => n.size), 1));
      geometry.setAttribute("aStrength", new THREE.Float32BufferAttribute(data.nodes.map(n => n.strength), 1));
      this.geometries.add(geometry); parent.add(new THREE.Points(geometry, this.pointsMaterial));
      const links = new THREE.BufferGeometry();
      links.setAttribute("position", new THREE.Float32BufferAttribute(data.links.flatMap(i => data.nodes[i].point.toArray()), 3));
      links.setAttribute("color", new THREE.Float32BufferAttribute(data.links.flatMap(i => data.nodes[i].color.clone().multiplyScalar(.45 + data.nodes[i].strength * .4).toArray()), 3));
      this.geometries.add(links); parent.add(new THREE.LineSegments(links, filaments));
      const paths = new THREE.BufferGeometry();
      paths.setAttribute("position", new THREE.Float32BufferAttribute(data.paths, 3));
      paths.setAttribute("color", new THREE.Float32BufferAttribute(data.pathColors, 3));
      const colors = paths.getAttribute("color") as THREE.BufferAttribute;
      pulseSurfaces.push({ colors, baseline: new Float32Array(colors.array), paths: data.pulsePaths });
      this.geometries.add(paths); parent.add(new THREE.LineSegments(paths, structure));
      this.nodeCount += data.nodes.length; this.connectionCount += data.links.length / 2; this.pathSegments += data.paths.length / 6;
    }
    this.pulse = new StructuralEnergyPulse(pulseSurfaces, changed);
    const signature = meshes.find(mesh => mesh.name === "NTS_Mask_MouseSignature");
    if (signature) {
      const geometry = new THREE.EdgesGeometry(signature.geometry, 30);
      const ink = new THREE.LineBasicMaterial({ color: "#d5fbff", transparent: true, opacity: .95, depthWrite: false });
      this.geometries.add(geometry); this.materials.add(ink); this.head.add(new THREE.LineSegments(geometry, ink));
      this.pathSegments += geometry.getAttribute("position").count / 2;
    }
    this.group.traverse(object => {
      if (object instanceof THREE.Points || object instanceof THREE.LineSegments) {
        object.frustumCulled = false; this.drawObjects++;
        this.drawRanges.push({ geometry: object.geometry, ...object.geometry.drawRange, vertices: object.geometry.getAttribute("position").count, paired: object instanceof THREE.LineSegments });
      }
    });
    this.materials.forEach(material => this.presentationOpacities.set(material, material.opacity));
    this.resize(typeof window === "undefined" ? 900 : window.innerHeight, typeof window === "undefined" ? 1 : window.devicePixelRatio);
  }
  setMode(mode: PresenceMode): void {
    if (this.disposed || this.mode === mode) return;
    this.pulse.setEligible(false);
    this.mode = mode;
    this.originals.forEach(({ mesh, layers }) => { mesh.layers.mask = mode === "hologram" ? 0 : layers; });
    this.group.visible = this.available && mode === "hologram";
  }
  /** Bounded transition overlay; canonical buffers/material values are restored at settle. */
  setTransitionMix(normalVisible: boolean, weight: number): void {
    this.transitionWeight = THREE.MathUtils.clamp(weight, 0, 1);
    this.originals.forEach(({ mesh, layers }) => { mesh.layers.mask = normalVisible ? layers : 0; });
    this.group.visible = this.available && this.transitionWeight > .0001;
    this.pointsMaterial.uniforms.uPresentationOpacity.value = this.transitionWeight * this.contextOpacity;
    this.presentationOpacities.forEach((opacity, material) => { if (material !== this.pointsMaterial) material.opacity = opacity * this.transitionWeight! * this.contextOpacity; });
    this.drawRanges.forEach(({ geometry, vertices, paired, start, count }) => {
      const reveal = Math.floor(vertices * Math.sqrt(this.transitionWeight!));
      geometry.setDrawRange(start, this.transitionWeight === 1 ? count : paired ? reveal - reveal % 2 : reveal);
    });
  }
  clearTransitionMix(): void {
    this.transitionWeight = undefined; this.pointsMaterial.uniforms.uPresentationOpacity.value = this.contextOpacity;
    this.presentationOpacities.forEach((opacity, material) => { material.opacity = opacity * this.contextOpacity; });
    this.drawRanges.forEach(({ geometry, start, count }) => geometry.setDrawRange(start, count));
    this.originals.forEach(({ mesh, layers }) => { mesh.layers.mask = this.mode === "hologram" ? 0 : layers; });
    this.group.visible = this.available && this.mode === "hologram";
  }
  setAvailable(available: boolean): void { this.available = available; this.group.visible = available && (this.transitionWeight === undefined ? this.mode === "hologram" : this.transitionWeight > .0001); if (!available) this.pulse.setEligible(false); }
  setReading(reading: boolean): void {
    this.normalMaterials.forEach(material => { if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = reading ? .015 : .055; });
  }
  resize(height: number, ratio = 1): void { this.pointsMaterial.uniforms.uHeight.value = height * Math.min(ratio, 2); }
  /** Smaller photographic stages retain the same nodes without merging their points. */
  setContextPointScale(scale: number): void { this.pointsMaterial.uniforms.uContextPointScale.value = THREE.MathUtils.clamp(scale, .1, 1); }
  /** A surrounding scene can soften the presentation without changing graph data. */
  setContextOpacity(opacity: number): void {
    this.contextOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const weight = (this.transitionWeight ?? 1) * this.contextOpacity;
    this.pointsMaterial.uniforms.uPresentationOpacity.value = weight;
    this.presentationOpacities.forEach((base, material) => { if (material !== this.pointsMaterial) material.opacity = base * weight; });
  }
  get inspection() {
    return { mode: this.mode, visible: this.group.visible, canonicalHidden: this.originals.every(({ mesh }) => mesh.layers.mask === 0),
      normalMaterialCount: this.normalMaterials.size, nodeCount: this.nodeCount, connectionCount: this.connectionCount,
      structuralSegments: this.pathSegments, geometryCount: this.geometries.size, materialCount: this.materials.size, textureCount: 0, drawObjects: this.drawObjects };
  }
  dispose(): void {
    if (this.disposed) return;
    this.setMode("normal"); this.disposed = true;
    this.pulse.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.group.removeFromParent();
  }
}

function sampleSurface(geometry: THREE.BufferGeometry, count: number, seed: number, target: Field): void {
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal"), index = geometry.getIndex();
  const cumulative: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let area = 0;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    a.fromBufferAttribute(position, index?.getX(i) ?? i); b.fromBufferAttribute(position, index?.getX(i + 1) ?? i + 1); c.fromBufferAttribute(position, index?.getX(i + 2) ?? i + 2);
    area += b.sub(a).cross(c.sub(a)).length() * .5; cumulative.push(area);
  }
  for (let i = 0; i < count; i++) {
    const goal = area * (i + .5) / count; let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < goal) lo = mid + 1; else hi = mid; }
    const u = Math.sqrt(fraction((i + seed * 19 + 1) * .754877666)), v = fraction((i + seed * 31 + 1) * .569840291);
    const weights = [1 - u, u * (1 - v), u * v], point = new THREE.Vector3(), direction = new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      const vertex = index?.getX(lo * 3 + k) ?? lo * 3 + k;
      point.addScaledVector(a.fromBufferAttribute(position, vertex), weights[k]); direction.addScaledVector(a.fromBufferAttribute(normal, vertex), weights[k]);
    }
    direction.normalize(); point.addScaledVector(direction, .0006);
    const fade = THREE.MathUtils.smoothstep(point.y, 1.045, 1.16), accent = (i + seed * 3) % 23 === 0;
    const color = cyan.clone().lerp(lavender, fraction((i + seed) * .381966) > .8 ? .85 : .12);
    target.nodes.push({ point, normal: direction, color, size: accent ? .010 : .0015 + fraction(i * .618) * .0009, strength: fade * (accent ? 1 : .32 + fraction(i * .417) * .5) });
  }
}

function connect(data: Field): void {
  const seen = new Set<string>();
  for (let i = 0; i < data.nodes.length; i++) {
    const nearest: { index: number; distance: number }[] = [];
    for (let j = 0; j < data.nodes.length; j++) {
      if (i === j) continue; const distance = data.nodes[i].point.distanceToSquared(data.nodes[j].point);
      if (distance > .045 ** 2 || distance < .0008 ** 2) continue; nearest.push({ index: j, distance });
    }
    nearest.sort((a, b) => a.distance - b.distance);
    for (const neighbor of nearest.slice(0, 4)) {
      const a = Math.min(i, neighbor.index), b = Math.max(i, neighbor.index), key = `${a}:${b}`;
      if (!seen.has(key)) { data.links.push(a, b); seen.add(key); }
    }
  }
}

function addSegment(data: Field, a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color, strength: number): void {
  data.paths.push(...a.toArray(), ...b.toArray()); const c = color.clone().multiplyScalar(strength); data.pathColors.push(...c.toArray(), ...c.toArray());
}

function traceMeridians(geometry: THREE.BufferGeometry, target: Field, low: number, high: number, pulseAngles: readonly number[]): void {
  const positions = geometry.getAttribute("position"), steps = 24;
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const slices: { point: THREE.Vector3; score: number }[] = [];
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i); if (y < low || y > high) continue;
      const row = Math.min(steps, Math.round((y - low) / (high - low) * steps)), score = positions.getX(i) * Math.cos(angle) + positions.getZ(i) * Math.sin(angle);
      if (!slices[row] || score > slices[row].score) slices[row] = { point: new THREE.Vector3().fromBufferAttribute(positions, i), score };
    }
    const anchors = slices.filter(Boolean).map(slice => slice.point); if (anchors.length < 3) continue;
    const points = new THREE.CatmullRomCurve3(anchors).getPoints(72);
    const start = target.paths.length / 6;
    for (let i = 1; i < points.length; i++) addSegment(target, points[i - 1], points[i], angle > Math.PI ? lavender : cyan, .65);
    if (pulseAngles.includes(angle)) target.pulsePaths.push({ start, segments: points.length - 1 });
  }
}

function energyArcs(data: Field): void {
  for (let i = 17; i < data.nodes.length; i += 53) {
    const a = data.nodes[i], b = data.nodes[(i + 31) % data.nodes.length], distance = a.point.distanceTo(b.point);
    if (distance < .012 || distance > .095) continue;
    const middle = a.point.clone().lerp(b.point, .5).addScaledVector(a.normal, .012), points = new THREE.QuadraticBezierCurve3(a.point, middle, b.point).getPoints(8);
    for (let j = 1; j < points.length; j++) addSegment(data, points[j - 1], points[j], i % 2 ? lavender : cyan, .8);
  }
}
