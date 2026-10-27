import * as THREE from "three";
import { MindHomeInvitation } from "./MindHomeInvitation";
import { CONDITIONS, REGISTRATION, deterministicSample, isRainExterior, type ImagePolygon, type ImageRect, type MindHomeCondition } from "./registration";

const TRANSITION_MS = 2500;
const NARRATIVE_OUT_MS = 260;
const EVENT_MS: Record<MindHomeCondition, number> = { "cool-air": 4200, "sun-shade": 3500, "rain-green": 4600 };
const FILES: Record<MindHomeCondition, string> = { "cool-air": "cool-air.png", "sun-shade": "sun-and-shade.png", "rain-green": "rain-and-green.png" };
const KIND = { "cool-air": "far-mist", "sun-shade": "reflected-light", "rain-green": "rain-water" } as const;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (value: number) => value * value * (3 - 2 * value);

function polygonFunction(name: string, polygon: ImagePolygon): string {
  const points = polygon.map(([x, y]) => `vec2(${x.toFixed(5)},${y.toFixed(5)})`);
  return `bool ${name}(vec2 p){bool inside=false; vec2 a;vec2 b; ${points.map((p, i) => `a=${p};b=${points[(i + polygon.length - 1) % polygon.length]}; if((a.y>p.y)!=(b.y>p.y)){if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}`).join("\n")}return inside;}`;
}
const WATER_MASK = `${polygonFunction("waterRegion", REGISTRATION.water)}\n${REGISTRATION.stones.map((p, i) => polygonFunction(`stone${i}`, p)).join("\n")}\nbool inWater(vec2 p){return waterRegion(p)&&!stone0(p)&&!stone1(p)&&!stone2(p);}`;
const RAIN_MASK = `${polygonFunction("shelter", REGISTRATION.shelter)}\n${REGISTRATION.rainExterior.map((p, i) => polygonFunction(`exterior${i}`, p)).join("\n")}\nbool inRain(vec2 p){return (exterior0(p)||exterior1(p))&&!shelter(p);}`;
const PLANE_VERTEX = `uniform vec4 uRect; varying vec2 vImage; varying vec2 vLocal; void main(){vLocal=uv;vImage=uRect.xy+vec2(uv.x,1.0-uv.y)*uRect.zw;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

/** A photographic destination pass. The StoryScene renderer remains the sole RAF owner. */
export class MindHomePresentation {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, .01, 10);
  private readonly invitation: MindHomeInvitation;
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private readonly imageMaterial = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  private readonly image = new THREE.Mesh(this.plane, this.imageMaterial);
  private readonly transitionMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, depthTest: false, depthWrite: false });
  private readonly transitionImage = new THREE.Mesh(this.plane, this.transitionMaterial);
  private readonly veilMaterial = new THREE.MeshBasicMaterial({ color: "#39433f", transparent: true, opacity: 0, toneMapped: false, depthTest: false, depthWrite: false });
  private readonly veil = new THREE.Mesh(this.plane, this.veilMaterial);
  private readonly effectGroup = new THREE.Group();
  private readonly shaders: THREE.ShaderMaterial[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>([this.plane]);
  private readonly textures = new Map<MindHomeCondition, THREE.Texture>();
  private readonly materials = new Set<THREE.Material>([this.imageMaterial, this.transitionMaterial, this.veilMaterial]);
  private readonly effectObjects = new Map<MindHomeCondition, THREE.Object3D[]>();
  private current: MindHomeCondition = "cool-air";
  private requested: MindHomeCondition = "cool-air";
  private transitionStarted?: number;
  private eventStarted?: number;
  private loadPromise?: Promise<void>;
  private ready = false;
  private disposed = false;
  private visible = true;
  private reducedMotion: boolean;

  constructor(private readonly options: { invalidate: () => void; reducedMotion: boolean }) {
    this.reducedMotion = options.reducedMotion;
    this.invitation = new MindHomeInvitation(this.scene, () => this.invalidate(), options.reducedMotion);
    this.camera.position.z = 3;
    this.scene.background = new THREE.Color("#173b46");
    this.image.position.set(.5, .5, 0); this.image.renderOrder = 0;
    this.transitionImage.position.set(.5, .5, .01); this.transitionImage.renderOrder = 1; this.transitionImage.visible = false;
    this.veil.position.set(.5, .5, .1); this.veil.renderOrder = 20; this.veil.visible = false;
    this.scene.add(this.image, this.transitionImage, this.effectGroup, this.veil);
    this.createMist(); this.createReflection(); this.createRain(); this.hideEffects();
  }

  async load(): Promise<void> {
    if (this.disposed) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      const loader = new THREE.TextureLoader();
      const results = await Promise.allSettled(CONDITIONS.map(async condition => {
        const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}mindhome/${FILES[condition]}`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
        if (this.disposed) { texture.dispose(); return; }
        this.textures.set(condition, texture);
      }));
      if (this.disposed) return;
      const failure = results.find(result => result.status === "rejected");
      if (failure?.status === "rejected") {
        this.textures.forEach(texture => texture.dispose()); this.textures.clear();
        throw failure.reason;
      }
      this.ready = true; this.imageMaterial.map = this.textures.get(this.current)!; this.imageMaterial.needsUpdate = true;
      this.beginEvent(performance.now()); this.invalidate();
    })();
    return this.loadPromise;
  }

  select(condition: MindHomeCondition): boolean {
    if (!this.ready || this.disposed || !CONDITIONS.includes(condition) || this.transitionStarted !== undefined || condition === this.current || ["inviting", "dismissing"].includes(this.invitation.inspection.phase)) return false;
    this.hideEffects(); this.eventStarted = undefined; this.requested = condition;
    this.invitation.setBusy(true);
    if (this.reducedMotion || !this.visible) this.finishTransition();
    else {
      this.transitionStarted = performance.now();
      this.transitionMaterial.map = this.textures.get(condition)!;
      this.transitionMaterial.opacity = 0; this.transitionImage.visible = true;
      this.veil.visible = true;
    }
    this.invalidate(); return true;
  }

  /** Only event uniforms change per frame. No timers, allocations or texture/geometry recreation. */
  update(now: number): boolean {
    if (this.disposed || !this.ready || !this.visible) return false;
    let animate = false;
    if (this.transitionStarted !== undefined) {
      const elapsed = now - this.transitionStarted;
      if (elapsed < NARRATIVE_OUT_MS) animate = true;
      else {
        const progress = clamp((elapsed - NARRATIVE_OUT_MS) / (TRANSITION_MS - NARRATIVE_OUT_MS));
        this.transitionMaterial.opacity = easeInOut(progress);
        this.veilMaterial.opacity = .07 * Math.sin(Math.PI * progress) ** 2;
        if (progress < 1) animate = true;
        else { this.finishTransition(); this.beginEvent(now); }
      }
    }
    if (this.eventStarted !== undefined) {
      const progress = clamp((now - this.eventStarted) / EVENT_MS[this.current]);
      if (progress >= 1) { this.eventStarted = undefined; this.hideEffects(); }
      else {
        const envelope = Math.sin(Math.PI * progress) ** 2;
        for (const material of this.shaders) { material.uniforms.uProgress.value = progress; material.uniforms.uEnvelope.value = envelope; }
        animate = true;
      }
    }
    this.invitation.setBusy(this.transitionStarted !== undefined || this.eventStarted !== undefined);
    return this.invitation.update(now) || animate;
  }

  toggleInvitation(): boolean {
    if (!this.ready || this.disposed || this.transitionStarted !== undefined) return false;
    // A human invitation takes the stage; stop the optional local weather event.
    this.eventStarted = undefined; this.hideEffects(); this.invitation.setBusy(false);
    return this.invitation.toggle();
  }
  dismissInvitation(): boolean { return this.invitation.dismiss(); }
  resizeInvitation(height: number, ratio: number): void { this.invitation.resize(height, ratio); }

  setReducedMotion(reduced: boolean): void {
    if (this.disposed || reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (reduced) { this.finishTransition(); this.eventStarted = undefined; this.hideEffects(); }
    this.invitation.setReducedMotion(reduced);
    this.invalidate();
  }

  setVisible(visible: boolean): void {
    if (this.disposed || visible === this.visible) return;
    this.visible = visible;
    if (!visible) { this.finishTransition(); this.eventStarted = undefined; this.hideEffects(); }
    else this.invalidate();
    this.invitation.setVisible(visible);
  }

  get inspection() {
    return {
      ready: this.ready, currentCondition: this.current, requestedCondition: this.requested,
      transitionActive: this.transitionStarted !== undefined, effectActive: this.eventStarted !== undefined,
      effectKind: this.eventStarted === undefined ? null : KIND[this.current],
      eventDurationMs: EVENT_MS[this.current], transitionDurationMs: TRANSITION_MS,
      resources: { geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size },
      registeredRegions: { mist: 2, rainLayers: 2, rippleCenters: REGISTRATION.waterRippleCenters.length },
      invitation: this.invitation.inspection,
      reducedMotion: this.reducedMotion, visible: this.visible, disposed: this.disposed,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.ready = false; this.transitionStarted = this.eventStarted = undefined;
    this.invitation.dispose();
    this.textures.forEach(texture => texture.dispose()); this.textures.clear();
    this.materials.forEach(material => material.dispose()); this.materials.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear();
    this.shaders.length = 0; this.effectObjects.clear(); this.scene.clear();
  }

  private invalidate(): void { if (this.visible && !this.disposed) this.options.invalidate(); }
  private setCurrent(condition: MindHomeCondition): void { this.current = condition; this.imageMaterial.map = this.textures.get(condition)!; }
  private finishTransition(): void {
    this.transitionStarted = undefined; this.veil.visible = false; this.veilMaterial.opacity = 0;
    this.transitionImage.visible = false; this.transitionMaterial.opacity = 0; this.transitionMaterial.map = null;
    if (this.ready) this.setCurrent(this.requested);
  }
  private beginEvent(now: number): void {
    this.hideEffects();
    if (this.reducedMotion || !this.visible || this.disposed) return;
    this.eventStarted = now;
    this.effectObjects.get(this.current)?.forEach(object => { object.visible = true; });
    for (const material of this.shaders) { material.uniforms.uProgress.value = 0; material.uniforms.uEnvelope.value = 0; }
  }
  private hideEffects(): void { this.effectGroup.children.forEach(object => { object.visible = false; }); }
  private addEffect(condition: MindHomeCondition, object: THREE.Object3D): void {
    const objects = this.effectObjects.get(condition) ?? []; objects.push(object); this.effectObjects.set(condition, objects);
    this.effectGroup.add(object); object.renderOrder = 5; object.frustumCulled = false;
  }
  private material(fragmentShader: string, rect: ImageRect, vertexShader = PLANE_VERTEX, extras: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uProgress: { value: 0 }, uEnvelope: { value: 0 }, uRect: { value: new THREE.Vector4(rect.x, rect.y, rect.width, rect.height) }, ...extras },
      vertexShader, fragmentShader,
    });
    this.shaders.push(material); this.materials.add(material); return material;
  }
  private effectPlane(material: THREE.ShaderMaterial, rect: ImageRect): THREE.Mesh {
    const mesh = new THREE.Mesh(this.plane, material); mesh.scale.set(rect.width, rect.height, 1); mesh.position.set(rect.x + rect.width / 2, 1 - rect.y - rect.height / 2, .02); return mesh;
  }
  private createMist(): void {
    const regions = [REGISTRATION.farMist, REGISTRATION.aboveRoofMist];
    const rects = [{ x: .075, y: .31, width: .32, height: .34 }, { x: .42, y: .28, width: .32, height: .10 }];
    regions.forEach((polygon, index) => {
      const rect = rects[index];
      const fragment = `varying vec2 vImage;varying vec2 vLocal;uniform float uProgress;uniform float uEnvelope;
        ${polygonFunction("region", polygon)}
        void main(){if(!region(vImage))discard;vec2 p=vLocal-vec2(.5+uProgress*.045,.48);float edge=pow(max(0.0,1.0-dot(p*vec2(2.15,2.6),p*vec2(2.15,2.6))),3.0);float drift=.72+.28*sin(vLocal.x*12.0+vLocal.y*7.0-uProgress*1.9);gl_FragColor=vec4(.79,.85,.83,edge*drift*uEnvelope*${index === 0 ? ".075" : ".045"});}`;
      this.addEffect("cool-air", this.effectPlane(this.material(fragment, rect), rect));
    });
  }
  private createReflection(): void {
    const rect = { x: .16, y: .74, width: .28, height: .13 };
    const fragment = `varying vec2 vImage;varying vec2 vLocal;uniform float uProgress;uniform float uEnvelope;
      ${WATER_MASK}
      void main(){if(!inWater(vImage))discard;float edge=pow(max(0.0,1.0-length((vLocal-.5)*vec2(1.8,1.65))),2.0);float ribbons=pow(.5+.5*sin(vLocal.y*73.0+sin(vLocal.x*19.0)*1.5-uProgress*3.3),9.0);float broken=.4+.6*pow(.5+.5*sin(vLocal.x*37.0+vLocal.y*9.0),2.0);gl_FragColor=vec4(.89,.85,.66,edge*ribbons*broken*uEnvelope*.095);}`;
    this.addEffect("sun-shade", this.effectPlane(this.material(fragment, rect), rect));
  }
  private createRain(): void {
    for (let layer = 0; layer < 2; layer++) {
      const count = layer ? 88 : 126;
      const positions: number[] = [], seeds: number[] = [], ends: number[] = [];
      for (let index = 0; index < count; index++) {
        let x = 0, y = 0;
        for (let attempt = 0; attempt < 32; attempt++) {
          x = .11 + deterministicSample(index * 32 + attempt, layer + 2) * .78;
          y = .15 + deterministicSample(index * 32 + attempt, layer + 8) * .60;
          if (isRainExterior([x, y])) break;
        }
        positions.push(x, 1 - y, .03, x, 1 - y, .03);
        seeds.push(deterministicSample(index, layer + 24), deterministicSample(index, layer + 24)); ends.push(0, 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1)); geometry.setAttribute("aEnd", new THREE.Float32BufferAttribute(ends, 1));
      this.geometries.add(geometry);
      const vertex = `attribute float aSeed;attribute float aEnd;uniform float uProgress;varying vec2 vImage;varying float vSeed;void main(){vec3 p=position;float travel=mod(aSeed+uProgress*${layer ? "1.24" : ".78"},1.0);p.y=1.0-(.15+travel*.62);p.x-=travel*.010;p.y-=aEnd*${layer ? ".018" : ".011"};p.x-=aEnd*.0015;vImage=vec2(p.x,1.0-p.y);vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
      const fragment = `uniform float uEnvelope;varying vec2 vImage;varying float vSeed;${RAIN_MASK}
        void main(){if(!inRain(vImage))discard;float edge=smoothstep(.15,.21,vImage.y)*(1.0-smoothstep(.66,.75,vImage.y));gl_FragColor=vec4(.76,.84,.84,uEnvelope*edge*${layer ? ".14" : ".10"}*(.6+.4*vSeed));}`;
      this.addEffect("rain-green", new THREE.LineSegments(geometry, this.material(fragment, { x: 0, y: 0, width: 1, height: 1 }, vertex)));
    }
    const rect = { x: .16, y: .74, width: .28, height: .13 };
    const centers = REGISTRATION.waterRippleCenters.map(([x, y], i) => `float d${i}=length((vImage-vec2(${x.toFixed(5)},${y.toFixed(5)}))*vec2(1.0,2.35));float age${i}=fract(uProgress*1.45+${(i * .28).toFixed(2)});float ring${i}=(1.0-smoothstep(.0008,.0020,abs(d${i}-(.002+age${i}*.020))))*(1.0-age${i});`).join("\n");
    const fragment = `varying vec2 vImage;uniform float uProgress;uniform float uEnvelope;${WATER_MASK}
      void main(){if(!inWater(vImage))discard;${centers}float ring=max(ring0,max(ring1,ring2));gl_FragColor=vec4(.68,.79,.78,ring*uEnvelope*.14);}`;
    this.addEffect("rain-green", this.effectPlane(this.material(fragment, rect), rect));
  }
}
