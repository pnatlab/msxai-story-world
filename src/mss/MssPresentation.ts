import * as THREE from "three";
import { MssAtmosphere } from "./atmosphere";
import { createMssTerrain } from "./terrain";
import { frameAt, phaseAt } from "./story";

const KEYFRAMES = [
  { at: 0, sky: "#101b3a", horizon: "#444f6e", fog: "#657693", shadow: "#283d59", sun: "#bca0b8", rock: "#353550", ambient: "#465879", glow: .31, stars: .22, level: 30, density: .95, haze: .94 },
  { at: .23, sky: "#34547c", horizon: "#b6a3a9", fog: "#c6c4cf", shadow: "#66788e", sun: "#ffb689", rock: "#df9463", ambient: "#7589a1", glow: .90, stars: 0, level: 26, density: .95, haze: .77 },
  { at: .46, sky: "#3978a5", horizon: "#cae2e8", fog: "#e5e9eb", shadow: "#879eb3", sun: "#ffe2b3", rock: "#e8d2a3", ambient: "#9bb6c6", glow: .65, stars: 0, level: 21, density: .73, haze: .55 },
  { at: .63, sky: "#2876ac", horizon: "#bddee9", fog: "#eef3ee", shadow: "#8ba3b8", sun: "#fff2dc", rock: "#f6e4c2", ambient: "#afc8d0", glow: .44, stars: 0, level: 12.7, density: .52, haze: .38 },
  { at: .81, sky: "#315381", horizon: "#cba494", fog: "#d2bbc0", shadow: "#726e8c", sun: "#ffc094", rock: "#d39a77", ambient: "#8490ae", glow: .88, stars: .04, level: 14, density: .64, haze: .55 },
  { at: 1, sky: "#07142d", horizon: "#313e5c", fog: "#7489a7", shadow: "#283752", sun: "#a3add1", rock: "#4a5b83", ambient: "#415577", glow: .2, stars: .87, level: 17, density: .84, haze: .77 },
] as const;
const colors = ["sky", "horizon", "fog", "shadow", "sun", "rock", "ambient"] as const;
const palettes = KEYFRAMES.map(frame => colors.map(key => new THREE.Color(frame[key])));

/** One bounded renderer pass. Time, atmosphere and camera are functions of scroll. */
export class MssPresentation {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(44, 1, .5, 700);
  private readonly terrain = createMssTerrain();
  private readonly atmosphere = new MssAtmosphere();
  private readonly palette = colors.map(() => new THREE.Color());
  private readonly sunDirection = new THREE.Vector3();
  private readonly skyLightDirection = new THREE.Vector3();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private progress = 0;
  private frame = 0;

  constructor() {
    this.scene.add(this.terrain.object, this.atmosphere.group);
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.geometries.add(object.geometry);
      const material: THREE.Material = object.material;
      this.materials.add(material);
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof THREE.Texture) this.textures.add(uniform.value);
        }
      }
    });
  }

  update(progress: number, aspect: number, reducedMotion: boolean): void {
    const t = frameAt(progress, reducedMotion);
    this.progress = progress;
    this.frame = t;
    const portrait = 1 - THREE.MathUtils.smoothstep(aspect, .47, 1.32);
    const approach = Math.sin(t * Math.PI * .85);
    const opening = THREE.MathUtils.smoothstep(t, .65, 1);
    this.camera.aspect = aspect;
    this.camera.fov = 44 + portrait * 12 + opening * 2;
    this.camera.position.set(32 - approach * 13 + opening * 7, 39 - approach * 8 + opening * 15, 62 - approach * 53 + opening * 23 + portrait * 32);
    this.camera.lookAt(14 - portrait * 18, 24 - approach * 6, -120);
    this.camera.updateProjectionMatrix();

    const end = KEYFRAMES.findIndex(frame => frame.at >= t && frame.at > 0);
    const start = end - 1;
    const a = KEYFRAMES[start], b = KEYFRAMES[end];
    const fraction = THREE.MathUtils.smoothstep(t, a.at, b.at);
    const mix = (from: number, to: number) => THREE.MathUtils.lerp(from, to, fraction);
    this.palette.forEach((color, i) => color.lerpColors(palettes[start][i], palettes[end][i], fraction));
    const [skyTop, skyHorizon, fogColor, fogShadow, sunColor, rockLight, ambientColor] = this.palette;
    this.sunDirection.set(-.86 + t * 1.12, .13 + Math.sin(t * Math.PI) * .62, .50 - t * .94).normalize();
    this.skyLightDirection.set(.72 - t * .16, .035 + Math.sin(t * Math.PI) ** 4 * .42, -.78).normalize();
    const fogLevel = mix(a.level, b.level);
    this.terrain.setAtmosphere({
      sunDirection: this.sunDirection, sunColor: rockLight, ambientColor,
      hazeColor: skyHorizon, haze: mix(a.haze, b.haze), fogLevel, fogColor,
    });
    this.atmosphere.update({
      progress: reducedMotion ? 0 : t, skyTop, skyHorizon, fogColor, fogShadow, sunColor,
      fogLevel, fogDensity: mix(a.density, b.density), sunDirection: this.skyLightDirection,
      sunStrength: mix(a.glow, b.glow), stars: mix(a.stars, b.stars),
    });
  }

  get inspection() {
    return {
      progress: this.progress, phase: phaseAt(this.progress), frame: this.frame, cameraPosition: this.camera.position.toArray(),
      resources: { geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size },
    };
  }

  dispose(): void {
    this.terrain.dispose();
    this.atmosphere.dispose();
    this.scene.clear();
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}
