import * as THREE from "three";
import { CameraDirector } from "./CameraDirector";
import { AMBIENT_FIELD_V0_1 } from "./ambientField";
import type { StoryState } from "../story/storyState";
import type { CameraState, Relationship, StoryWorldDefinition, WorldNode } from "../world/world.schema";

export interface SceneInspection {
  readonly rendererType: "WebGLRenderer";
  readonly cameraType: "PerspectiveCamera";
  readonly cameraPosition: readonly [number, number, number];
  readonly cameraTarget: readonly [number, number, number];
  readonly sceneObjectPositions: Readonly<Record<string, readonly [number, number, number]>>;
  readonly semanticNodeCount: number;
  readonly ambientNodeCount: number;
  readonly semanticConnectionCount: number;
  readonly ambientConnectionCount: number;
  readonly activeStoryBeat: string;
  readonly selectedNode?: string;
  readonly renderLoopActive: boolean;
  readonly usesRaycasting: true;
  readonly disposed: boolean;
  readonly renderCount: number;
}

export interface StorySceneOptions {
  readonly world: StoryWorldDefinition;
  readonly reducedMotion: boolean;
  readonly onSelectNode: (nodeId: string) => void;
  readonly onRender: () => void;
}

type NodeVisual = {
  readonly group: THREE.Group;
  readonly ornament: THREE.Group;
  readonly hitTarget: THREE.Object3D;
  readonly focusShell: THREE.Mesh;
};

type ConnectionVisual = {
  readonly group: THREE.Group;
  readonly relationship: Relationship;
  readonly curve: THREE.CatmullRomCurve3;
  readonly pulse?: THREE.Mesh;
};

type AmbientVisual = {
  readonly object: THREE.Object3D;
  readonly revealAtBeat: number;
};

const BACKGROUND = new THREE.Color("#030b1c");
const WARM = new THREE.Color("#f2d6a0");
const ICE = new THREE.Color("#bff5ff");

export class StoryScene {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;
  public readonly director: CameraDirector;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly nodeVisuals = new Map<string, NodeVisual>();
  private readonly nodeTargets: THREE.Object3D[] = [];
  private readonly relationshipVisuals = new Map<string, ConnectionVisual>();
  private readonly ambientVisuals: AmbientVisual[] = [];
  private readonly ocean: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly resizeObserver: ResizeObserver;
  private pointerStart?: THREE.Vector2;
  private animationFrame?: number;
  private active = true;
  private reducedMotion: boolean;
  private currentState?: StoryState;
  private disposed = false;
  private fieldMotionUntil = 0;
  private manualInteractionUntil = 0;
  private renderCount = 0;
  private hoverNodeId?: string;

  public constructor(private readonly container: HTMLElement, private readonly options: StorySceneOptions) {
    this.reducedMotion = options.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(BACKGROUND, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "story-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
    this.camera.position.set(7.2, 6.2, 20);
    this.director = new CameraDirector(this.camera, this.renderer.domElement, this.reducedMotion);
    this.scene.fog = new THREE.FogExp2("#06132b", 0.021);

    this.scene.add(new THREE.HemisphereLight("#bcefff", "#020817", 1.2));
    const humanLight = new THREE.PointLight("#f6d9a3", 18, 23, 2);
    humanLight.position.set(-1, 5, 5);
    this.scene.add(humanLight);
    const fieldLight = new THREE.PointLight("#7addf3", 24, 42, 2);
    fieldLight.position.set(1, 8, -7);
    this.scene.add(fieldLight);

    this.createCosmicEnvironment();
    this.ocean = this.createOcean();
    this.scene.add(this.ocean);
    this.createOceanTraces();
    this.createAmbientField();
    this.createSemanticNodes();
    this.createSemanticRelationships();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.resize();
  }

  public present(state: StoryState, moveCamera = true, immediate = false): void {
    this.currentState = state;
    const beat = this.options.world.beats[state.beatIndex];
    const visibleNodeIds = state.mode === "free" ? this.options.world.nodes.map((node) => node.id) : beat.revealNodeIds;
    const visibleRelationshipIds = state.mode === "free"
      ? this.options.world.relationships.map((relationship) => relationship.id)
      : beat.revealRelationshipIds;

    this.nodeVisuals.forEach((visual, id) => {
      visual.group.visible = visibleNodeIds.includes(id);
      const focused = state.selectedNodeId === id;
      visual.focusShell.visible = focused;
      visual.focusShell.scale.setScalar(focused ? 1.12 : 1);
      visual.group.scale.setScalar(this.hoverNodeId === id ? 1.055 : 1);
    });
    this.relationshipVisuals.forEach((visual, id) => {
      visual.group.visible = visibleRelationshipIds.includes(id);
      const focused = state.selectedNodeId === visual.relationship.from || state.selectedNodeId === visual.relationship.to;
      this.setConnectionEmphasis(visual.group, focused);
      if (visual.pulse) visual.pulse.visible = visual.group.visible && !this.reducedMotion;
    });
    this.ambientVisuals.forEach((visual) => {
      visual.object.visible = state.mode === "free" || state.beatIndex >= visual.revealAtBeat;
    });

    if (moveCamera) {
      const cameraState = this.getCameraState(beat.cameraStateId);
      this.director.moveTo(cameraState, immediate || state.mode === "free");
      this.fieldMotionUntil = performance.now() + (this.reducedMotion ? 0 : cameraState.durationMs + 1050);
    }
    this.requestRender();
  }

  public resetCamera(): void {
    if (!this.currentState) return;
    const beat = this.options.world.beats[this.currentState.beatIndex];
    this.director.moveTo(this.getCameraState(beat.cameraStateId), true);
    this.requestRender();
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.director.setReducedMotion(reduced);
    this.relationshipVisuals.forEach((visual) => {
      if (visual.pulse) visual.pulse.visible = visual.group.visible && !reduced;
    });
    this.requestRender();
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (active) this.requestRender();
    else if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  public projectNode(nodeId: string): { x: number; y: number; depth: number; visible: boolean } {
    const visual = this.nodeVisuals.get(nodeId);
    if (!visual || !visual.group.visible) return { x: 0, y: 0, depth: 1, visible: false };
    const projected = visual.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((-projected.y + 1) / 2) * rect.height,
      depth: projected.z,
      visible: projected.z > -1 && projected.z < 1,
    };
  }

  public getInspection(): SceneInspection {
    const sceneObjectPositions: Record<string, readonly [number, number, number]> = {};
    this.options.world.nodes.forEach((node) => { sceneObjectPositions[node.id] = node.position; });
    return {
      rendererType: "WebGLRenderer",
      cameraType: "PerspectiveCamera",
      cameraPosition: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      cameraTarget: [this.director.target.x, this.director.target.y, this.director.target.z],
      sceneObjectPositions,
      semanticNodeCount: this.options.world.nodes.length,
      ambientNodeCount: AMBIENT_FIELD_V0_1.layers.reduce((count, layer) => count + layer.nodes.length, 0),
      semanticConnectionCount: this.options.world.relationships.length,
      ambientConnectionCount: AMBIENT_FIELD_V0_1.connections.length,
      activeStoryBeat: this.currentState ? this.options.world.beats[this.currentState.beatIndex].id : "opening",
      selectedNode: this.currentState?.selectedNodeId,
      renderLoopActive: Boolean(this.animationFrame),
      usesRaycasting: true,
      disposed: this.disposed,
      renderCount: this.renderCount,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setActive(false);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.director.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach((material) => material.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private createCosmicEnvironment(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(420);
    const colors = new Float32Array(420);
    for (let index = 0; index < positions.length; index += 3) {
      const seed = index / 3 + 1;
      const depth = 18 + ((seed * 29) % 110);
      positions[index] = ((seed * 47) % 90) - 45;
      positions[index + 1] = ((seed * 31) % 48) - 7;
      positions[index + 2] = -depth;
      const brightness = 0.32 + ((seed * 13) % 11) / 35;
      colors[index] = brightness * 0.65;
      colors[index + 1] = brightness * 0.9;
      colors[index + 2] = brightness;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.scene.add(new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.075, transparent: true, opacity: 0.6, vertexColors: true, depthWrite: false }),
    ));

    const planetPosition = new THREE.Vector3(34, -69, -112);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(48, 48, 30),
      new THREE.MeshStandardMaterial({ color: "#397d9b", emissive: "#0c3854", emissiveIntensity: 0.34, transparent: true, opacity: 0.56, roughness: 0.9, metalness: 0, fog: false }),
    );
    planet.position.copy(planetPosition);
    this.scene.add(planet);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(49.4, 48, 30),
      new THREE.MeshBasicMaterial({ color: "#8ae2f3", transparent: true, opacity: 0.055, side: THREE.BackSide, fog: false }),
    );
    atmosphere.position.copy(planetPosition);
    this.scene.add(atmosphere);

    const rings = new THREE.Mesh(
      new THREE.RingGeometry(57, 57.18, 128, 1, 0.18, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({ color: "#9edbec", transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    rings.position.copy(planetPosition);
    rings.rotation.set(Math.PI * 0.43, -0.18, Math.PI * 0.12);
    this.scene.add(rings);

    const horizonGlow = new THREE.Mesh(
      new THREE.RingGeometry(48.4, 49.7, 128, 1, Math.PI * 0.06, Math.PI * 0.88),
      new THREE.MeshBasicMaterial({ color: "#9cecff", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    horizonGlow.position.copy(planetPosition);
    horizonGlow.lookAt(this.camera.position);
    this.scene.add(horizonGlow);
  }

  private createOcean(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const geometry = new THREE.PlaneGeometry(100, 90, 64, 64);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uStill: { value: this.reducedMotion ? 1 : 0 },
        uNearColor: { value: new THREE.Color("#0b5471") },
        uFarColor: { value: new THREE.Color("#04162d") },
        uTraceColor: { value: new THREE.Color("#58c5e2") },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uStill;
        varying float vWave;
        varying vec2 vField;
        void main() {
          vField = position.xy;
          float t = mix(uTime, 0.0, uStill);
          float waveA = sin(position.x * 0.18 + t * 0.42) * 0.15;
          float waveB = cos(position.y * 0.13 - t * 0.31) * 0.11;
          float interference = sin((position.x + position.y) * 0.075 + t * 0.2) * 0.08;
          vec3 displaced = position;
          displaced.z += waveA + waveB + interference;
          vWave = displaced.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uStill;
        uniform vec3 uNearColor;
        uniform vec3 uFarColor;
        uniform vec3 uTraceColor;
        varying float vWave;
        varying vec2 vField;
        void main() {
          float t = mix(uTime, 0.0, uStill);
          float distanceFade = smoothstep(48.0, 5.0, length(vField));
          float interference = sin(vField.x * 0.24 + sin(vField.y * 0.08) * 2.4 + t * 0.35);
          float sparseTrace = pow(max(0.0, interference), 18.0);
          float crest = smoothstep(0.10, 0.30, vWave) * 0.16;
          vec3 color = mix(uFarColor, uNearColor, distanceFade * 0.72 + 0.1);
          color = mix(color, uTraceColor, sparseTrace * 0.24 + crest);
          float alpha = (0.18 + sparseTrace * 0.16 + crest * 0.16) * distanceFade;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const ocean = new THREE.Mesh(geometry, material);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -1.45, -24);
    return ocean;
  }

  private createOceanTraces(): void {
    const group = new THREE.Group();
    group.name = "ambient:ocean-traces";
    for (let index = 0; index < 7; index += 1) {
      const offset = (index - 3) * 6.2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-42, -1.19, -8 + offset * 0.14),
        new THREE.Vector3(-18, -1.05 + (index % 2) * 0.08, -16 + offset),
        new THREE.Vector3(8, -1.12, -28 + offset * 0.7),
        new THREE.Vector3(42, -1.24, -42 + offset * 0.4),
      ], false, "centripetal", 0.3);
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(72)),
        new THREE.LineBasicMaterial({ color: index % 2 ? "#2c8cab" : "#55bdd6", transparent: true, opacity: 0.075, depthWrite: false }),
      ));
    }
    this.scene.add(group);
  }

  private createAmbientField(): void {
    AMBIENT_FIELD_V0_1.layers.forEach((layer) => {
      const geometry = new THREE.IcosahedronGeometry(1, 0);
      const material = new THREE.MeshBasicMaterial({ color: "#69cce2", transparent: true, opacity: 0.34, depthWrite: false });
      const mesh = new THREE.InstancedMesh(geometry, material, layer.nodes.length);
      const matrix = new THREE.Matrix4();
      layer.nodes.forEach((node, index) => {
        const scale = node.scale * (0.88 + node.brightness * 0.45);
        matrix.compose(new THREE.Vector3(...node.position), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = `ambient-nodes:${layer.id}`;
      this.ambientVisuals.push({ object: mesh, revealAtBeat: layer.revealAtBeat });
      this.scene.add(mesh);
    });

    AMBIENT_FIELD_V0_1.connections.forEach((connection) => {
      const curve = new THREE.CatmullRomCurve3(connection.points.map((point) => new THREE.Vector3(...point)), false, "centripetal", 0.35);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(42)),
        new THREE.LineBasicMaterial({ color: "#69bdd4", transparent: true, opacity: 0.14, depthWrite: false }),
      );
      line.name = `ambient-connection:${connection.id}`;
      this.ambientVisuals.push({ object: line, revealAtBeat: connection.revealAtBeat });
      this.scene.add(line);
    });
  }

  private createSemanticNodes(): void {
    this.options.world.nodes.forEach((node) => {
      const visual = this.createSemanticNode(node);
      visual.group.position.set(...node.position);
      visual.group.name = `semantic-node:${node.id}`;
      visual.hitTarget.userData.nodeId = node.id;
      this.nodeVisuals.set(node.id, visual);
      this.nodeTargets.push(visual.hitTarget);
      this.scene.add(visual.group);
    });
  }

  private createSemanticNode(node: WorldNode): NodeVisual {
    const group = new THREE.Group();
    const ornament = new THREE.Group();
    group.add(ornament);
    const focusRadius = node.kind === "framework"
      ? 3.15
      : node.kind === "listening-layer"
        ? 1.55
        : node.kind === "language-signal"
          ? 0.34
          : node.kind === "principle"
            ? 0.42
            : node.kind === "ecosystem-anchor"
              ? 1.08
              : 0.96;
    const focusShell = new THREE.Mesh(
      new THREE.TorusGeometry(focusRadius, 0.018, 5, 72),
      new THREE.MeshBasicMaterial({ color: node.kind === "human" ? WARM : ICE, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    focusShell.rotation.set(0.72, 0.34, 0.16);
    focusShell.visible = false;
    ornament.add(focusShell);

    if (node.kind === "human") this.buildHumanAnchor(ornament);
    else if (node.kind === "intention") this.buildIntentionAnchor(ornament);
    else if (node.kind === "framework") this.buildMsxaiField(ornament);
    else if (node.kind === "ecosystem-anchor") this.buildEcosystemAnchor(ornament, node.id);
    else if (node.kind === "listening-layer") this.buildListeningLayer(ornament);
    else if (node.kind === "language-signal") this.buildLanguageSignal(ornament);
    else this.buildPrincipleNode(ornament);

    const hitRadius = node.kind === "framework"
      ? 2.4
      : node.kind === "listening-layer"
        ? 1.25
        : node.kind === "language-signal"
          ? 0.5
          : node.kind === "principle"
            ? 0.72
            : node.kind === "ecosystem-anchor"
              ? 0.95
              : 1.15;
    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(hitRadius, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    group.add(hitTarget);
    return { group, ornament, hitTarget, focusShell };
  }

  private buildHumanAnchor(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 2),
      new THREE.MeshBasicMaterial({ color: "#ffe5ad", transparent: true, opacity: 0.94 }),
    ));
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 28, 20),
      new THREE.MeshStandardMaterial({ color: "#f3d6a0", emissive: "#725426", emissiveIntensity: 0.45, transparent: true, opacity: 0.24, roughness: 0.18, metalness: 0.06, depthWrite: false }),
    ));
    [0.82, 1.02].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.018, 5, 64),
        new THREE.MeshBasicMaterial({ color: index === 0 ? "#f6d79e" : "#b4e8ed", transparent: true, opacity: 0.42 - index * 0.12, depthWrite: false }),
      );
      ring.rotation.set(Math.PI * (0.35 + index * 0.15), index * 0.8, index * 0.5);
      group.add(ring);
    });
  }

  private buildIntentionAnchor(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 2),
      new THREE.MeshStandardMaterial({ color: "#e5fbff", emissive: "#4fabc4", emissiveIntensity: 0.62, roughness: 0.24, metalness: 0.12 }),
    ));
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 24, 18),
      new THREE.MeshBasicMaterial({ color: "#8adbed", transparent: true, opacity: 0.12, depthWrite: false }),
    ));
    [0.9, 1.18, 1.48].forEach((radius, index) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.014, 4, 72, Math.PI * (1.18 + index * 0.13)),
        new THREE.MeshBasicMaterial({ color: "#bff5ff", transparent: true, opacity: 0.32 - index * 0.055, depthWrite: false }),
      );
      arc.rotation.set(index * 0.72, 0.5 + index * 0.37, index * 0.44);
      group.add(arc);
    });
  }

  private buildMsxaiField(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.31, 2),
      new THREE.MeshBasicMaterial({ color: "#d9fbff", transparent: true, opacity: 0.9 }),
    ));
    [1.15, 1.75, 2.35, 2.95].forEach((radius, index) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.018 - index * 0.002, 4, 86, Math.PI * (1.25 + index * 0.12)),
        new THREE.MeshBasicMaterial({ color: index < 2 ? "#b9f3ff" : "#58b6d2", transparent: true, opacity: 0.4 - index * 0.065, depthWrite: false }),
      );
      arc.rotation.set(0.3 + index * 0.46, -0.7 + index * 0.32, index * 0.51);
      group.add(arc);
    });
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 22, 15),
      new THREE.MeshBasicMaterial({ color: "#63c7df", wireframe: true, transparent: true, opacity: 0.022, depthWrite: false }),
    ));
  }

  private buildEcosystemAnchor(group: THREE.Group, id: string): void {
    const colors = {
      mindhome: "#c3f6ff",
      mss: "#8fd8ec",
      mhb: "#bdeff1",
      "wave-glass-project-h": "#9fd9ee",
    } as const;
    const color = colors[id as keyof typeof colors] ?? "#b6e8f2";
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(id === "mhb" ? 0.27 : 0.24, 1),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.24, roughness: 0.34, metalness: 0.1 }),
    ));

    if (id === "mss") {
      [-0.42, 0.42].forEach((offset, index) => {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.46, 0.04),
          new THREE.MeshBasicMaterial({ color: index === 0 ? "#d3f8ff" : "#64b8d0", wireframe: true, transparent: true, opacity: 0.28, depthWrite: false }),
        );
        frame.position.set(offset, index ? 0.1 : -0.1, index ? -0.14 : 0.14);
        frame.rotation.set(0.45 + index * 0.25, 0.5 - index * 0.6, 0.2);
        group.add(frame);
      });
      return;
    }

    if (id === "wave-glass-project-h") {
      const pane = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 36),
        new THREE.MeshBasicMaterial({ color: "#aeeeff", transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false }),
      );
      pane.rotation.set(0.7, 0.4, 0.2);
      group.add(pane);
      group.add(new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.014, 4, 56),
        new THREE.MeshBasicMaterial({ color: "#aeeeff", transparent: true, opacity: 0.32, depthWrite: false }),
      ));
      return;
    }

    const radii = id === "mindhome" ? [0.58, 0.88] : [0.52, 0.72, 0.94];
    radii.forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.012, 4, 56),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 - index * 0.055, depthWrite: false }),
      );
      ring.rotation.set(0.48 + index * 0.58, index * 0.72, 0.28 + index * 0.31);
      group.add(ring);
    });
  }

  private buildListeningLayer(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.28, 20, 14),
      new THREE.MeshBasicMaterial({ color: "#7ed8ed", transparent: true, opacity: 0.035, depthWrite: false }),
    ));
    [0.58, 0.93, 1.28].forEach((radius, index) => {
      const resonance = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.014, 4, 72, Math.PI * (1.18 + index * 0.16)),
        new THREE.MeshBasicMaterial({ color: index === 1 ? "#b8f6ff" : "#68c6df", transparent: true, opacity: 0.25 - index * 0.04, depthWrite: false }),
      );
      resonance.rotation.set(0.45 + index * 0.7, -0.3 + index * 0.46, index * 0.34);
      group.add(resonance);
    });
    const flow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.08, 0.2, -0.18),
      new THREE.Vector3(-0.26, 0.78, 0.22),
      new THREE.Vector3(0.34, -0.58, -0.16),
      new THREE.Vector3(1.1, 0.12, 0.2),
    ]);
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(flow.getPoints(32)),
      new THREE.LineBasicMaterial({ color: "#b9f7ff", transparent: true, opacity: 0.32, depthWrite: false }),
    ));
  }

  private buildLanguageSignal(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.1, 1),
      new THREE.MeshBasicMaterial({ color: "#d5fbff", transparent: true, opacity: 0.84, depthWrite: false }),
    ));
    [0.22, 0.38].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.009, 4, 42),
        new THREE.MeshBasicMaterial({ color: "#7dc9dd", transparent: true, opacity: 0.3 - index * 0.08, depthWrite: false }),
      );
      ring.rotation.set(index * 0.9 + 0.4, index * 0.6, 0.2);
      group.add(ring);
    });
  }

  private buildPrincipleNode(group: THREE.Group): void {
    group.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.17, 1),
      new THREE.MeshStandardMaterial({ color: "#caeff5", emissive: "#377d95", emissiveIntensity: 0.34, roughness: 0.42, metalness: 0.08 }),
    ));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.01, 4, 42),
      new THREE.MeshBasicMaterial({ color: "#8bd2e2", transparent: true, opacity: 0.28, depthWrite: false }),
    );
    ring.rotation.set(0.7, 0.4, 0.2);
    group.add(ring);
  }

  private createSemanticRelationships(): void {
    this.options.world.relationships.forEach((relationship) => {
      const from = this.options.world.nodes.find((node) => node.id === relationship.from);
      const to = this.options.world.nodes.find((node) => node.id === relationship.to);
      if (!from || !to) return;
      const group = new THREE.Group();
      group.name = `semantic-relationship:${relationship.id}`;
      const fromVector = new THREE.Vector3(...from.position);
      const toVector = new THREE.Vector3(...to.position);
      const primary = relationship.kind === "holds-intention";
      const progression = relationship.kind === "story-progression";
      const conceptual = relationship.kind === "conceptual-connection";
      const curve = this.makeSpatialCurve(
        fromVector,
        toVector,
        primary ? 1.15 : progression ? -1.4 : conceptual ? 0.72 : 0.4,
        primary ? 1.7 : progression ? 2.3 : conceptual ? 1.05 : 0.7,
      );

      if (primary || progression) {
        group.add(new THREE.Mesh(
          new THREE.TubeGeometry(curve, 52, primary ? 0.021 : 0.017, 5, false),
          new THREE.MeshBasicMaterial({ color: primary ? "#d7faff" : "#71c9df", transparent: true, opacity: primary ? 0.56 : 0.4, depthWrite: false }),
        ));
        [-1, 1].forEach((direction) => {
          const companion = this.makeSpatialCurve(fromVector, toVector, direction * (primary ? 1.85 : 1.15), (primary ? 0.9 : 1.45) + direction * 0.2);
          group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(companion.getPoints(48)),
            new THREE.LineBasicMaterial({ color: primary ? "#81d6e7" : "#4b9eb8", transparent: true, opacity: 0.23, depthWrite: false }),
          ));
        });
      } else {
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(38)),
          new THREE.LineBasicMaterial({
            color: relationship.to === "nutuensai" ? "#9ae4ef" : "#6ab9cc",
            transparent: true,
            opacity: conceptual ? 0.16 : 0.22,
            depthWrite: false,
          }),
        ));
      }

      let pulse: THREE.Mesh | undefined;
      if (primary || progression) {
        pulse = new THREE.Mesh(
          new THREE.SphereGeometry(primary ? 0.085 : 0.065, 10, 8),
          new THREE.MeshBasicMaterial({ color: primary ? "#f8e2b7" : "#c6f7ff", transparent: true, opacity: 0.8, depthWrite: false }),
        );
        pulse.visible = !this.reducedMotion;
        group.add(pulse);
      }
      this.relationshipVisuals.set(relationship.id, { group, relationship, curve, pulse });
      this.scene.add(group);
    });
  }

  private makeSpatialCurve(from: THREE.Vector3, to: THREE.Vector3, side: number, rise: number): THREE.CatmullRomCurve3 {
    const direction = to.clone().sub(from);
    const lateral = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(side);
    const first = from.clone().lerp(to, 0.32).add(lateral).add(new THREE.Vector3(0, rise, 0));
    const second = from.clone().lerp(to, 0.68).add(lateral.clone().multiplyScalar(-0.45)).add(new THREE.Vector3(0, rise * 0.72, -0.7));
    return new THREE.CatmullRomCurve3([from, first, second, to], false, "centripetal", 0.35);
  }

  private setConnectionEmphasis(group: THREE.Group, focused: boolean): void {
    group.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material & { opacity?: number } | undefined;
      if (!material || material.opacity === undefined) return;
      const baseOpacity = Number(object.userData.baseOpacity ?? material.opacity);
      object.userData.baseOpacity = baseOpacity;
      material.opacity = Math.min(1, baseOpacity * (focused ? 1.35 : 1));
    });
  }

  private requestRender(): void {
    if (!this.active || this.disposed || this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  private readonly renderFrame = (now: number): void => {
    this.animationFrame = undefined;
    if (!this.active || this.disposed) return;
    const transitioning = this.director.update(now, this.getCameraStateForCurrentBeat().allowManualControl);
    const animate = !this.reducedMotion && (transitioning || this.fieldMotionUntil > now || this.manualInteractionUntil > now || this.currentState?.mode === "free");
    this.animateField(now);
    this.renderer.render(this.scene, this.camera);
    this.renderCount += 1;
    this.options.onRender();
    if (animate || transitioning) this.requestRender();
  };

  private animateField(now: number): void {
    const time = now * 0.001;
    this.ocean.material.uniforms.uStill.value = this.reducedMotion ? 1 : 0;
    if (!this.reducedMotion) this.ocean.material.uniforms.uTime.value = time;
    this.nodeVisuals.forEach((visual, id) => {
      if (!visual.group.visible || this.reducedMotion) return;
      const phase = id.length * 0.37;
      visual.ornament.rotation.y = Math.sin(time * 0.16 + phase) * 0.12;
      visual.ornament.rotation.x = Math.cos(time * 0.11 + phase) * 0.045;
      if (id === "nutuensai") {
        visual.ornament.rotation.z = Math.sin(time * 0.2) * 0.14;
        visual.ornament.scale.setScalar(1 + Math.sin(time * 0.56) * 0.018);
      } else if (id === "lli") {
        visual.ornament.rotation.z = time * 0.16;
        visual.ornament.scale.setScalar(1 + Math.sin(time * 0.72) * 0.026);
      } else {
        visual.ornament.scale.setScalar(1);
      }
    });
    this.relationshipVisuals.forEach((visual, id) => {
      if (!visual.pulse || !visual.group.visible) return;
      const phase = id.length * 0.071;
      visual.pulse.position.copy(visual.curve.getPoint((time * 0.075 + phase) % 1));
    });
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.requestRender();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerStart = new THREE.Vector2(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.director.controls.enabled) {
      this.manualInteractionUntil = performance.now() + 260;
      this.requestRender();
    }
    const nodeId = this.pickNode(event);
    if (nodeId !== this.hoverNodeId) {
      const previous = this.hoverNodeId;
      this.hoverNodeId = nodeId;
      if (previous) this.nodeVisuals.get(previous)?.group.scale.setScalar(1);
      if (nodeId) this.nodeVisuals.get(nodeId)?.group.scale.setScalar(1.055);
      this.renderer.domElement.style.cursor = nodeId ? "pointer" : "grab";
      this.requestRender();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.pointerStart = undefined;
    if (!start || start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 8 || this.director.isTransitioning) return;
    const nodeId = this.pickNode(event);
    if (nodeId) this.options.onSelectNode(nodeId);
  };

  private pickNode(event: PointerEvent): string | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.nodeTargets, false)[0]?.object.userData.nodeId as string | undefined;
  }

  private getCameraState(id: string): CameraState {
    const state = this.options.world.cameraStates.find((cameraState) => cameraState.id === id);
    if (!state) throw new Error(`Missing camera state: ${id}`);
    return state;
  }

  private getCameraStateForCurrentBeat(): CameraState {
    const beat = this.currentState ? this.options.world.beats[this.currentState.beatIndex] : this.options.world.beats[0];
    return this.getCameraState(beat.cameraStateId);
  }
}
