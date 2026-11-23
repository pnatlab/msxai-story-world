import * as THREE from "three";
import { mssTerrainHeightAt } from "./terrain";

export interface MssAtmosphereState {
  readonly progress: number;
  readonly skyTop: THREE.Color;
  readonly skyHorizon: THREE.Color;
  readonly fogColor: THREE.Color;
  readonly fogShadow: THREE.Color;
  readonly fogLevel: number;
  readonly fogDensity: number;
  readonly sunDirection: THREE.Vector3;
  readonly sunColor: THREE.Color;
  readonly sunStrength: number;
  readonly stars: number;
}

const skyColor = /* glsl */ `
  uniform sampler2D cloudNoise;
  uniform vec3 skyTop;
  uniform vec3 skyHorizon;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunStrength;

  vec3 atmosphereSky(vec3 direction) {
    float elevation = clamp(direction.y, 0.0, 1.0);
    float zenith = 1.0 - exp(-4.6 * elevation);
    vec3 sky = mix(skyHorizon, skyTop, zenith);
    vec3 glowDirection = normalize(vec3(sunDirection.x, clamp(sunDirection.y, .015, .16), sunDirection.z));
    float glow = pow(max(dot(direction, glowDirection), 0.0), 3.6);
    glow *= exp(-3.9 * abs(direction.y - glowDirection.y));
    return mix(sky, sunColor, glow * clamp(sunStrength, 0.0, 1.0) * .39);
  }
`;

const skyVertex = /* glsl */ `
  varying vec3 skyRay;
  void main() {
    skyRay = position;
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = clip.xyww;
  }
`;

const skyFragment = /* glsl */ `
  ${skyColor}
  varying vec3 skyRay;
  uniform float stars;

  float starHash(vec2 cell) {
    cell = fract(cell * vec2(123.34, 456.21));
    cell += dot(cell, cell + 45.32);
    return fract(cell.x * cell.y);
  }

  void main() {
    vec3 ray = normalize(skyRay);
    vec3 color = atmosphereSky(ray);
    if (ray.y > .07 && sunStrength > .22) {
      vec2 upperWind = ray.xz * vec2(.28, .66) / (.16 + ray.y);
      vec3 veil = texture2D(cloudNoise, upperWind + vec2(.32, .08)).rgb;
      float fibers = texture2D(cloudNoise, upperWind * 2.8).g;
      float cirrus = smoothstep(.51, .79, veil.r * .72 + fibers * .28);
      cirrus *= smoothstep(.07, .19, ray.y) * (1.0 - smoothstep(.32, .60, ray.y));
      color = mix(color, mix(skyHorizon, sunColor, .23), cirrus * sunStrength * .37);
    }
    if (stars > 0.001) {
      vec2 cellPosition = vec2(atan(ray.x, -ray.z), asin(ray.y)) * 120.0;
      vec2 cell = floor(cellPosition);
      float seed = starHash(cell);
      vec2 center = vec2(.18) + .64 * vec2(starHash(cell + 13.7), starHash(cell - 7.9));
      float radius = mix(.042, .111, seed);
      float footprint = max(radius, .48 * length(fwidth(cellPosition)));
      float point = 1.0 - smoothstep(footprint * .30, footprint, length(fract(cellPosition) - center));
      point *= pow(radius / footprint, 2.0);
      float sparkle = step(.974, seed) * point * smoothstep(.035, .24, ray.y);
      color += vec3(.45, .57, .73) * sparkle * stars;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const cloudVertex = /* glsl */ `
  uniform sampler2D cloudNoise;
  uniform float fogLevel;
  uniform float progress;
  uniform float layer;
  varying vec3 worldCloud;
  varying vec2 cloudUv;

  void main() {
    vec3 point = position;
    cloudUv = point.xz / 320.0 + vec2(progress * .026, progress * -.012);
    vec2 height = texture2D(cloudNoise, cloudUv).rg;
    // All decks use the same rising surface so adjacent alpha banks never intersect.
    point.y = fogLevel + layer * 3.1 + (height.x - .5) * 5.9 + (height.y - .5) * 2.8;
    worldCloud = (modelMatrix * vec4(point, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldCloud, 1.0);
  }
`;

const cloudFragment = /* glsl */ `
  ${skyColor}
  uniform sampler2D terrainHeights;
  uniform vec3 fogColor;
  uniform vec3 fogShadow;
  uniform float fogDensity;
  uniform float layer;
  varying vec3 worldCloud;
  varying vec2 cloudUv;

  void main() {
    vec3 fromEye = worldCloud - cameraPosition;
    float distanceFromEye = length(fromEye);
    vec3 ray = fromEye / max(distanceFromEye, .01);
    vec2 bankUv = cloudUv + layer * vec2(.037, -.029);
    vec3 sampleNoise = texture2D(cloudNoise, bankUv).rgb;
    vec2 turbulence = (sampleNoise.gb - .5) * vec2(.018, .033);
    vec2 rolled = bankUv + turbulence;
    vec3 folds = texture2D(cloudNoise, rolled * 3.1 + vec2(.48, .21)).rgb;
    float fine = texture2D(cloudNoise, rolled * 6.7 + vec2(.29, .47)).g;
    vec2 sunAcross = normalize(sunDirection.xz + vec2(.001, .001));
    float sunward = texture2D(cloudNoise, bankUv + sunAcross * .019).r;
    float windward = sampleNoise.r - sunward;
    float density = .60 * sampleNoise.r + .27 * folds.r + .13 * folds.b;
    float puff = smoothstep(.32, .71, density + (fine - .5) * .12);
    float nearDetail = 1.0 - smoothstep(70.0, 250.0, distanceFromEye);
    float filament = (fine - .5) * nearDetail;
    float light = clamp(.18 + puff * .69 + windward * .83 + filament * .18, .055, .97);
    vec3 color = mix(fogShadow, fogColor, light);
    color = mix(color, sunColor, sunStrength * max(windward, 0.0) * .24);
    float distant = smoothstep(92.0, 395.0, distanceFromEye);
    color = mix(color, atmosphereSky(ray), distant);
    vec2 hillsideUv = (worldCloud.xz + vec2(170.0, 295.0)) / vec2(340.0, 302.0);
    float ground = -15.0;
    if (all(greaterThanEqual(hillsideUv, vec2(0.0))) && all(lessThanEqual(hillsideUv, vec2(1.0)))) {
      ground += 64.0 * texture2D(terrainHeights, hillsideUv).r;
    }
    float clearOfGround = worldCloud.y - ground;
    #ifdef MSS_CLOUD_WISP
      // Irregular pockets above the cloud deck, lit and clipped in world space.
      // Thin out grazing silhouettes where a translucent bank would show its mesh edge.
      vec3 surfaceNormal = normalize(cross(dFdx(worldCloud), dFdy(worldCloud)));
      float profile = smoothstep(.018, .12, abs(dot(surfaceNormal, ray)));
      float pockets = smoothstep(.42, .67, density + (sampleNoise.b - .5) * .23);
      float nearby = smoothstep(7.0, 26.0, distanceFromEye);
      float alpha = pockets * nearby * profile * (1.0 - distant) * fogDensity * (.52 - layer * .10);
      alpha *= smoothstep(.35, 8.2 + layer * 2.1, clearOfGround);
      // Terrain shading supplies the haze on the massif itself. Keep the
      // shallow wisps in the open valley so they cannot stripe the rock face.
      vec2 valleyOffset = (worldCloud.xz - vec2(-15.0, -110.0)) * vec2(.65, 1.0);
      alpha *= smoothstep(48.0, 98.0, length(valleyOffset));
    #else
      float alpha = smoothstep(.0, 3.6 + density * 1.4, clearOfGround);
    #endif
    if (alpha < .003) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

function lattice(x: number, y: number, seed: number): number {
  let hash = Math.imul(x + seed, 0x45d9f3b) ^ Math.imul(y - seed, 0x27d4eb2d);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  return ((hash ^ (hash >>> 13)) >>> 0) / 0xffffffff;
}

function periodicNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period, y = v * period;
  const ix = Math.floor(x), iy = Math.floor(y);
  const dx = x - ix, dy = y - iy;
  const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
  const wrap = (n: number) => ((n % period) + period) % period;
  const x0 = wrap(ix), x1 = wrap(ix + 1), y0 = wrap(iy), y1 = wrap(iy + 1);
  const a = THREE.MathUtils.lerp(lattice(x0, y0, seed), lattice(x1, y0, seed), sx);
  const b = THREE.MathUtils.lerp(lattice(x0, y1, seed), lattice(x1, y1, seed), sx);
  return THREE.MathUtils.lerp(a, b, sy);
}

/** Small seamless lookup, generated in code rather than sourced from the reference video. */
function createCloudNoise(): THREE.DataTexture {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const warpedU = u + (periodicNoise(u, v, 5, 47) - .5) * .11;
      const warpedV = v + (periodicNoise(u, v, 5, 173) - .5) * .11;
      const lobes = periodicNoise(warpedU, warpedV, 7, 29);
      const rolls = periodicNoise(warpedU, warpedV, 13, 71);
      const billows = periodicNoise(warpedU, warpedV, 29, 131);
      const turbulence = periodicNoise(u, v, 59, 193);
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(255 * (.51 * lobes + .28 * rolls + .15 * billows + .06 * turbulence));
      pixels[i + 1] = Math.round(255 * (.43 * billows + .35 * turbulence + .22 * periodicNoise(u, v, 103, 269)));
      pixels[i + 2] = Math.round(255 * (.66 * periodicNoise(warpedU, warpedV, 9, 233) + .34 * billows));
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = "mss-atmosphere-noise";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createCloudDeck(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(2, 2, 100, 96);
  geometry.rotateX(-Math.PI / 2);
  const points = geometry.getAttribute("position");
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    // Concentrate geometry on the near banks. Ease into a wide, hazy horizon.
    points.setXYZ(i, 91 * x + 350 * x ** 3, 0, -54 + 93 * z + (z < 0 ? 420 : 97) * z ** 3);
  }
  return geometry;
}

/** Bakes the immutable terrain sampler for soft cloud / hillside intersections. */
function createTerrainHeights(): THREE.DataTexture {
  const size = 256;
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    const z = -295 + (y + .5) / size * 302;
    for (let x = 0; x < size; x++) {
      const height = mssTerrainHeightAt(-170 + (x + .5) / size * 340, z);
      pixels[y * size + x] = Math.round(255 * THREE.MathUtils.clamp((height + 15) / 64, 0, 1));
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
  texture.name = "mss-atmosphere-terrain-heights";
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A world-space cloud deck plus two shallow banks. Only scroll changes their phase. */
export class MssAtmosphere {
  readonly group = new THREE.Group();
  private readonly noise = createCloudNoise();
  private readonly terrainHeights = createTerrainHeights();
  private readonly skyGeometry = new THREE.SphereGeometry(1, 32, 16);
  private readonly cloudGeometry = createCloudDeck();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly uniforms = {
    cloudNoise: { value: this.noise },
    progress: { value: 0 },
    skyTop: { value: new THREE.Color() },
    skyHorizon: { value: new THREE.Color() },
    fogColor: { value: new THREE.Color() },
    fogShadow: { value: new THREE.Color() },
    fogLevel: { value: 0 },
    fogDensity: { value: 1 },
    sunDirection: { value: new THREE.Vector3(1, .1, -1).normalize() },
    sunColor: { value: new THREE.Color() },
    sunStrength: { value: 0 },
    stars: { value: 0 },
  };

  constructor() {
    this.group.name = "mss-atmosphere";
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
      side: THREE.BackSide, depthTest: false, depthWrite: false,
    });
    const sky = new THREE.Mesh(this.skyGeometry, skyMaterial);
    sky.name = "mss-sky";
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    this.materials.push(skyMaterial);
    this.group.add(sky);

    for (let layer = 0; layer < 3; layer++) {
      const isWisp = layer > 0;
      const material = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, terrainHeights: { value: this.terrainHeights }, layer: { value: layer } },
        defines: isWisp ? { MSS_CLOUD_WISP: 1 } : {},
        vertexShader: cloudVertex, fragmentShader: cloudFragment,
        side: THREE.DoubleSide, transparent: true, depthWrite: !isWisp, forceSinglePass: true,
      });
      const bank = new THREE.Mesh(this.cloudGeometry, material);
      bank.name = `mss-cloud-bank-${layer}`;
      bank.frustumCulled = false;
      bank.renderOrder = layer;
      this.materials.push(material);
      this.group.add(bank);
    }
  }

  update(state: MssAtmosphereState): void {
    const uniforms = this.uniforms;
    uniforms.progress.value = state.progress;
    uniforms.skyTop.value.copy(state.skyTop);
    uniforms.skyHorizon.value.copy(state.skyHorizon);
    uniforms.fogColor.value.copy(state.fogColor);
    uniforms.fogShadow.value.copy(state.fogShadow);
    uniforms.fogLevel.value = state.fogLevel;
    uniforms.fogDensity.value = state.fogDensity;
    uniforms.sunDirection.value.copy(state.sunDirection);
    uniforms.sunColor.value.copy(state.sunColor);
    uniforms.sunStrength.value = state.sunStrength;
    uniforms.stars.value = state.stars;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.noise.dispose();
    this.terrainHeights.dispose();
    this.skyGeometry.dispose();
    this.cloudGeometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
