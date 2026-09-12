import * as THREE from "three";
import { relatedNodeIds } from "../story/livingEcosystemState";
import type { CameraState, StoryWorldDefinition, Vec3Tuple } from "../world/world.schema";

type Visual = { group: THREE.Group; focusShell: THREE.Mesh };
type SavedVisual = { position: THREE.Vector3; scale: THREE.Vector3; visible: boolean; focus: boolean };
type SavedMaterial = { opacity: number; transparent: boolean };

// Presentation coordinates only. IDs and all meaning come from the canonical world.
const DESKTOP: Record<string, Vec3Tuple> = {
  human: [-10, 0.3, 4], intention: [-4.7, 2.2, 1], msxai: [-1.6, 3, -6],
  mindhome: [3, 4.8, -13], mss: [-10, 2.3, -10], mhb: [10, 1.7, -7],
  "wave-glass-project-h": [5, 0.2, 2], nutuensai: [9, 3, -17], lli: [-6, 0, -22],
  "principle-intention-first": [-7, 4, -4], "principle-structure-story": [0, 5, -9],
  "principle-repeatable-process": [5, 2, -6], "principle-auditor-not-pilot": [-6, 1, -13],
  "principle-return-agency": [-1, 1, 0],
};
const PORTRAIT: Record<string, Vec3Tuple> = {
  human: [-4, 0, 3], intention: [3.5, 1, 2], msxai: [-3, 1, -3], mss: [4, 0.5, -4],
  mindhome: [-4, 1, -7], mhb: [4, 1, -10], "wave-glass-project-h": [-5, 1, -17],
  nutuensai: [4, 1, -17], lli: [0, 0.3, -22],
  "principle-intention-first": [-0.8, 2, 0], "principle-structure-story": [0.5, 2, -6],
  "principle-repeatable-process": [0, 1, -11], "principle-auditor-not-pilot": [-1, 1, -16],
  "principle-return-agency": [-1.8, 0, 5],
};

export function ecosystemCamera(portrait: boolean): CameraState {
  return { id: "living-overview", position: portrait ? [0, 26, 34] : [5, 17, 29],
    target: portrait ? [0, 1, -6] : [0, 1, -5], fov: 45, durationMs: 1300, allowManualControl: true };
}

/** Reuses the existing semantic objects; owns only a reversible presentation and 13 quiet fragments. */
export class LivingEcosystemPresentation {
  readonly group = new THREE.Group();
  private readonly edges = new THREE.Group();
  private readonly resting = new THREE.LineBasicMaterial({ color: "#a5e2eb", transparent: true, opacity: 0.11, depthWrite: false });
  private readonly focused = new THREE.LineBasicMaterial({ color: "#ddfbff", transparent: true, opacity: 0.48, depthWrite: false });
  private readonly receded = new THREE.LineBasicMaterial({ color: "#75aebc", transparent: true, opacity: 0.025, depthWrite: false });
  private readonly veilMaterial = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uLight: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float uLight;
      void main(){float glow=1.0-smoothstep(0.0,0.85,length((vUv-vec2(.48,.45))*vec2(1.0,.8)));
      gl_FragColor=vec4(mix(vec3(.43,.75,.85),vec3(.92,.98,1.0),glow),uLight*(.48+.4*glow));}`,
  });
  private readonly veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.veilMaterial);
  private readonly saved = new Map<string, SavedVisual>();
  private readonly materials = new Map<THREE.Material, SavedMaterial>();
  private selected?: string;
  private portrait = false;
  private started = 0;
  private duration = 0;
  private phase: "closed" | "entering" | "open" | "leaving" = "closed";
  private arranged = false;
  private light = 0;

  constructor(private readonly world: StoryWorldDefinition, private readonly visuals: ReadonlyMap<string, Visual>) {
    this.group.name = "presentation:living-ecosystem";
    this.veil.name = "presentation:luminous-synthesis";
    this.veil.frustumCulled = false;
    this.veil.renderOrder = 100;
    this.veil.visible = false;
    this.edges.visible = false;
    this.group.add(this.edges, this.veil);
  }
  get isOpen(): boolean { return this.phase === "entering" || this.phase === "open"; }
  get isTransitioning(): boolean { return this.phase === "entering" || this.phase === "leaving"; }
  get inspection() {
    return { phase: this.phase, selectedNodeId: this.selected, fieldLight: this.light,
      relationshipIds: this.world.relationships.map((r) => r.id),
      emphasizedRelationshipIds: this.world.relationships.filter((r) => r.from === this.selected || r.to === this.selected).map((r) => r.id) };
  }
  enter(portrait: boolean, reduced: boolean, now: number): void {
    this.portrait = portrait;
    this.selected = undefined;
    this.saved.clear(); this.materials.clear();
    this.visuals.forEach((visual, id) => {
      this.saved.set(id, { position: visual.group.position.clone(), scale: visual.group.scale.clone(), visible: visual.group.visible, focus: visual.focusShell.visible });
      visual.group.traverse((object) => {
        const material = (object as THREE.Mesh).material;
        if (!material) return;
        (Array.isArray(material) ? material : [material]).forEach((m) => {
          if (!this.materials.has(m)) this.materials.set(m, { opacity: m.opacity, transparent: m.transparent });
          if (m.opacity > 0) m.transparent = true;
        });
      });
    });
    this.phase = "entering"; this.started = now; this.duration = reduced ? 0 : 1300; this.arranged = false;
    this.update(now, reduced);
  }
  leave(reduced: boolean, now: number): void {
    this.phase = "leaving"; this.started = now; this.duration = reduced ? 0 : 650;
    this.selected = undefined;
    this.restore(); this.edges.visible = false;
    this.update(now, reduced);
  }
  resize(portrait: boolean): void {
    this.portrait = portrait;
    if (this.isOpen && this.arranged) this.arrange();
  }
  select(id?: string): void { this.selected = id; if (this.arranged && this.isOpen) this.emphasize(); }
  update(now: number, reduced: boolean): number {
    if (!this.isTransitioning) return this.light;
    const t = reduced || this.duration === 0 ? 1 : THREE.MathUtils.clamp((now - this.started) / this.duration, 0, 1);
    if (this.phase === "entering") {
      if (!this.arranged && t >= 0.42) { this.arrange(); this.arranged = true; }
      this.light = t * t * (3 - 2 * t);
      this.veilMaterial.uniforms.uLight.value = reduced ? 0 : Math.sin(t * Math.PI) ** 2 * 0.85;
      if (this.arranged) this.emphasize(0.3 + 0.7 * Math.max(0, (t - 0.42) / 0.58));
    } else {
      this.light = 1 - t * t * (3 - 2 * t);
      this.veilMaterial.uniforms.uLight.value = reduced ? 0 : Math.sin(t * Math.PI) ** 2 * 0.35;
    }
    this.veil.visible = t < 1 && !reduced;
    if (t === 1) this.phase = this.phase === "entering" ? "open" : "closed";
    return this.light;
  }
  /** Own resources only; reused semantic meshes still belong to StoryScene. */
  dispose(): void {
    this.restore();
    this.group.removeFromParent();
    this.edges.children.forEach((object) => (object as THREE.LineSegments).geometry.dispose());
    this.veil.geometry.dispose(); this.veilMaterial.dispose();
    this.resting.dispose(); this.focused.dispose(); this.receded.dispose();
    this.edges.clear(); this.group.clear(); this.saved.clear(); this.materials.clear();
    this.phase = "closed"; this.light = 0;
  }
  private arrange(): void {
    const layout = this.portrait ? PORTRAIT : DESKTOP;
    this.visuals.forEach(({ group, focusShell }, id) => {
      group.position.set(...(layout[id] ?? this.world.nodes.find((node) => node.id === id)!.position));
      group.scale.setScalar(id === "msxai" ? 0.47 : id === "human" ? 0.85 : id.startsWith("principle-") ? 0.65 : 1);
      group.visible = true; focusShell.visible = false;
    });
    this.edges.children.forEach((object) => (object as THREE.LineSegments).geometry.dispose());
    this.edges.clear();
    this.world.relationships.forEach((relationship, index) => {
      const a = this.visuals.get(relationship.from)!.group.position;
      const b = this.visuals.get(relationship.to)!.group.position;
      const midpoint = a.clone().lerp(b, 0.5).add(new THREE.Vector3((index % 3 - 1) * 1.2, 1.6, -0.7));
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), midpoint, b.clone());
      const points: THREE.Vector3[] = [];
      for (let step = 4; step < 35; step++) {
        if (step >= 15 && step < 24) continue;
        // Canonical MSxAI relationships are numerous: show their distal resonance,
        // not a starburst of spokes converging on a controlling center.
        if (relationship.from === "msxai" && step < 24) continue;
        points.push(curve.getPoint(step / 40), curve.getPoint((step + 1) / 40));
      }
      const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), this.resting);
      line.name = `conceptual-fragments:${relationship.id}`;
      line.userData.relationship = relationship;
      this.edges.add(line);
    });
    this.edges.visible = true; this.emphasize();
  }
  private emphasize(reveal = 1): void {
    const neighbors = relatedNodeIds(this.world, this.selected);
    this.visuals.forEach((visual, id) => {
      const strength = !this.selected || this.selected === id ? 1 : neighbors.has(id) ? 0.78 : id === "human" ? 0.6 : 0.23;
      visual.focusShell.visible = this.selected === id;
      visual.group.traverse((object) => {
        const material = (object as THREE.Mesh).material;
        if (!material) return;
        (Array.isArray(material) ? material : [material]).forEach((m) => {
          const saved = this.materials.get(m);
          if (saved) m.opacity = saved.opacity * strength * reveal;
        });
      });
    });
    this.edges.children.forEach((object) => {
      const line = object as THREE.LineSegments;
      const { from, to } = line.userData.relationship;
      line.material = !this.selected ? this.resting : from === this.selected || to === this.selected ? this.focused : this.receded;
    });
  }
  private restore(): void {
    this.visuals.forEach((visual, id) => {
      const saved = this.saved.get(id);
      if (!saved) return;
      visual.group.position.copy(saved.position); visual.group.scale.copy(saved.scale);
      visual.group.visible = saved.visible; visual.focusShell.visible = saved.focus;
    });
    this.materials.forEach((saved, material) => { material.opacity = saved.opacity; material.transparent = saved.transparent; });
  }
}
