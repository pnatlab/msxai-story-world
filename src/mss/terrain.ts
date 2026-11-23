import * as THREE from "three";

interface TerrainLight {
  readonly sunDirection: THREE.Vector3;
  readonly sunColor: THREE.Color;
  readonly ambientColor: THREE.Color;
  readonly hazeColor: THREE.Color;
  readonly haze: number;
  readonly fogLevel?: number;
  readonly fogColor?: THREE.Color;
}

// Illustrated ridge measurements, authored by eye from the visual reference. They are
// world-space coordinates for one immutable terrain, not survey or elevation data.
const CREST = [
  [-131, -4, -119, 54], [-108, 7, -119, 58], [-91, 16, -116, 62],
  [-79, 23, -115, 68], [-69, 22, -115, 74], [-58, 28, -118, 81],
  [-43, 35, -120, 92], [-34, 37, -121, 90], [-22, 43, -120, 90],
  [-13, 41.4, -122, 88], [-5, 42, -122, 86], [6, 39.8, -126, 82],
  [12, 37.5, -125, 78], [21, 31, -125, 77], [27, 27, -124, 74],
  [32, 30.8, -122, 71], [38, 26, -123, 70], [44, 22, -126, 69],
  [59, 19, -134, 61], [73, 14, -141, 56], [87, 11, -148, 53],
  [103, 6, -150, 48], [124, -3, -154, 45],
] as const;

const BASE = -15;

function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }

function smooth(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function grain(x: number, z: number): number {
  let seed = Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1);
  seed = Math.imul(seed ^ (seed >>> 15), 0x85ebca6b);
  return ((seed ^ (seed >>> 13)) >>> 0) / 0xffffffff;
}

function noise(x: number, z: number): number {
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  const u = smooth(x - cellX);
  const v = smooth(z - cellZ);
  const near = mix(grain(cellX, cellZ), grain(cellX + 1, cellZ), u);
  const far = mix(grain(cellX, cellZ + 1), grain(cellX + 1, cellZ + 1), u);
  return mix(near, far, v);
}

function flank(x: number, z: number, midX: number, midZ: number, width: number, depth: number, peak: number): number {
  const a = (x - midX) / width;
  const b = (z - midZ) / depth;
  const body = Math.max(0, 1 - Math.hypot(a, b));
  return mix(BASE, peak, body);
}

export function mssTerrainHeightAt(x: number, z: number): number {
  let main = BASE;
  for (let i = 1; i < CREST.length; i++) {
    const left = CREST[i - 1];
    const right = CREST[i];
    if (x < left[0] || x > right[0]) continue;
    const t = (x - left[0]) / (right[0] - left[0]);
    const top = mix(left[1], right[1], t);
    const offset = z - mix(left[2], right[2], t);
    const front = offset > 0;
    // The near face descends more abruptly off the crest, then opens into an apron.
    const drop = Math.min(1, Math.abs(offset) / (front ? mix(left[3], right[3], t) : 53));
    const foot = smooth((x + 135) / 24) * smooth((127 - x) / 24);
    // Unequal buttresses and broken fractures in the limestone face. Warp the
    // fall-line field in world space so consecutive cuts do not repeat.
    const warp = noise(x * .038, z * .058) * 4.6;
    const folds = noise(x * .091 + z * .054 + warp, z * .067);
    const cuts = noise(x * .204 + z * .086 + warp, z * .096);
    const scree = noise(x * .51 + z * .15, z * .47 - x * .12);
    const cutDepth = smooth((cuts - .49) * 2.7);
    const facets = ((folds - .5) * 5.3 - cutDepth * 2.8 + (scree - .5) * 2.3) * Math.sin(drop * Math.PI) * foot;
    main = mix(BASE, top, 1 - Math.pow(drop, front ? .88 : .96)) + facets;
    break;
  }

  // Foothills and far ridges share the same depth-writing surface. Their heights,
  // positions, and relationships with the main mountain never change with lighting.
  const foothills = Math.max(
    flank(x, z, -78 + (z + 100) * .38, -94, 53, 66, 18),
    flank(x, z, -44 - (z + 100) * .42, -91, 33, 67, 21),
    flank(x, z, 19 + (z + 105) * .48, -107, 52, 67, 18),
    flank(x, z, 91 + (z + 145) * .42, -157, 60, 60, 17),
  );
  const distance = 22 + Math.sin(x * .081) * 2.9 + Math.sin(x * .218 + 2) * 2.4 + Math.sin(x * .48) * 1.2;
  const far = flank(x, z, 47, -203 + 10 * Math.sin(x * .063), 163, 58, distance);
  const furthest = flank(x, z, -103, -239 + 7 * Math.sin(x * .1), 155, 45, 19 + Math.sin(x * .118) * 3.2);
  const land = Math.max(main, foothills, far, furthest);
  const roughness = (noise(x * .36, z * .39) - .5) * 1.05 + (noise(x * .14 + 5, z * .21) - .5) * 1.5;
  return land + roughness * smooth((land - BASE) / 24);
}

export function createMssTerrain() {
  const geometry = new THREE.PlaneGeometry(340, 302, 190, 154);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -144);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, mssTerrainHeightAt(positions.getX(i), positions.getZ(i)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const uniforms = {
    sunDirection: { value: new THREE.Vector3(-.84, .44, .45).normalize() },
    sunColor: { value: new THREE.Color("#e6c4a6") },
    ambientColor: { value: new THREE.Color("#859ab4") },
    hazeColor: { value: new THREE.Color("#a3bacd") },
    haze: { value: .3 },
    fogLevel: { value: 16 },
    fogColor: { value: new THREE.Color("#a8bac7") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        terrainPoint = world.xyz;
        terrainNormal = mat3(modelMatrix) * normal;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform vec3 ambientColor;
      uniform vec3 hazeColor;
      uniform float haze;
      uniform float fogLevel;
      uniform vec3 fogColor;
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;

      float grain(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031, .11369, .13787));
        q += dot(q, q.yzx + 19.19);
        return fract((q.x + q.y) * q.z);
      }

      float terrainNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 blend = fract(p);
        blend *= blend * (3.0 - 2.0 * blend);
        return mix(mix(grain(cell), grain(cell + vec2(1.0, 0.0)), blend.x),
          mix(grain(cell + vec2(0.0, 1.0)), grain(cell + 1.0), blend.x), blend.y);
      }

      vec3 surfaceNormal(vec3 normal, float detail) {
        vec3 dx = dFdx(terrainPoint);
        vec3 dy = dFdy(terrainPoint);
        vec3 rx = cross(dy, normal);
        vec3 ry = cross(normal, dx);
        float orientation = dot(dx, rx);
        vec3 gradient = dFdx(detail) * rx + dFdy(detail) * ry;
        return normalize(max(abs(orientation), .00001) * normal - sign(orientation) * gradient);
      }

      void main() {
        vec3 n = normalize(terrainNormal);
        vec2 slopeSpace = terrainPoint.xz + vec2(terrainPoint.y * .66, -terrainPoint.y * .42);
        float broad = terrainNoise(slopeSpace * .16);
        vec2 cliffSpace = vec2(terrainPoint.x * .55 + terrainPoint.z * .40, terrainPoint.y * .37 + terrainPoint.z * .20);
        float stone = terrainNoise(cliffSpace + vec2(broad * 2.0, 0.0));
        float strata = terrainPoint.y * .48 + terrainPoint.z * .23 + terrainPoint.x * .067 + broad * 1.05 + stone * .56;
        float strataAA = clamp(fwidth(strata), .05, .23);
        float seams = 1.0 - smoothstep(.05, .05 + strataAA, abs(fract(strata) - .5));
        float high = smoothstep(22.0, 39.0, terrainPoint.y + (1.0 - n.y) * 13.0 + (broad - .5) * 10.0);
        float exposed = high * smoothstep(.16, .8, broad * .58 + stone * .59);
        vec2 canopySpace = slopeSpace * 2.9;
        float foliageAA = 1.0 - smoothstep(.84, 1.68, length(fwidth(canopySpace)));
        float canopy = mix(.5, terrainNoise(canopySpace), foliageAA);
        vec3 woodland = mix(vec3(.023, .038, .031), vec3(.090, .110, .073), .45 * broad + .55 * canopy);
        vec3 limestone = mix(vec3(.076, .073, .068), vec3(.387, .331, .251), .47 * stone + .53 * broad);
        limestone *= 1.0 - seams * smoothstep(.36, .75, stone) * .14;
        vec3 ground = mix(woodland, limestone, exposed);
        float bump = mix(canopy * .11, stone * .52, high);
        vec3 relief = surfaceNormal(n, bump);
        float face = max(0.0, dot(relief, sunDirection));
        float raking = smoothstep(.08, .67, face) * (exposed * (.38 + .62 * stone) + .16);
        vec3 color = ground * (ambientColor * (.8 + .2 * n.y) + sunColor * (face * .93 + raking * .81));
        float depth = length(cameraPosition - terrainPoint);
        float aerial = smoothstep(90.0, 259.0, depth) * (.13 + .52 * haze) + haze * haze * .09;
        float bank = (1.0 - smoothstep(fogLevel + 1.0, fogLevel + 10.5, terrainPoint.y)) * (.17 + haze * .29);
        color = mix(mix(color, hazeColor, clamp(aerial, 0.0, .8)), fogColor, bank);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const object = new THREE.Mesh(geometry, material);
  object.name = "MSS · Authored limestone massif and foothills";
  return {
    object,
    setAtmosphere(light: TerrainLight): void {
      uniforms.sunDirection.value.copy(light.sunDirection).normalize();
      uniforms.sunColor.value.copy(light.sunColor);
      uniforms.ambientColor.value.copy(light.ambientColor);
      uniforms.hazeColor.value.copy(light.hazeColor);
      uniforms.haze.value = light.haze;
      uniforms.fogLevel.value = light.fogLevel ?? 16;
      uniforms.fogColor.value.copy(light.fogColor ?? light.hazeColor);
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
