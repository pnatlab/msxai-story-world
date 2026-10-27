import * as THREE from "three";
import { MOUSE_SIGNATURE_NAME, mouseSignatureGeometry } from "./mouseSignature";

interface SnapshotObject { name: string; role: string; position: { offset: number; count: number }; normal: { offset: number; count: number }; index: { offset: number; count: number }; color?: { offset: number; count: number }; }

/** Reviewed H.1 hairstyle: soft overlapping updo volumes and two tapered face tendrils. */
function softBunGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const append = (geometry: THREE.BufferGeometry): void => {
    const offset = positions.length / 3, attribute = geometry.getAttribute("position");
    for (let i = 0; i < attribute.count; i++) positions.push(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
    const index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i++) indices.push(offset + index.getX(i));
    geometry.dispose();
  };
  // An irregular, tucked core is partly embedded in the existing rear crown.
  const core = new THREE.SphereGeometry(1, 28, 18), vertices = core.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const fold = 1 + .06 * Math.sin(Math.atan2(z, x) * 3 + y * 2);
    vertices.setXYZ(i, -.004 + x * .050 * fold, 1.678 + y * .046 * fold, -.067 + z * .044 * fold);
  }
  append(core);
  // Two broad diagonal tucks sit mostly inside the core. Their overlap gives a
  // softly irregular knot without open loops, sharp ribbons, or strand bundles.
  for (const tuck of [
    { center: [-.018, 1.694, -.073], scale: [.037, .030, .036], tilt: -.48 },
    { center: [.020, 1.678, -.080], scale: [.035, .031, .037], tilt: .52 },
  ]) {
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    geometry.scale(tuck.scale[0], tuck.scale[1], tuck.scale[2]);
    geometry.rotateZ(tuck.tilt); geometry.translate(...tuck.center as [number, number, number]); append(geometry);
  }
  const sweep = (points: readonly number[][], segments: number, sides: number,
    width: (t: number) => number, depth: (t: number) => number): void => {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), base = positions.length / 3;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments, center = path.getPoint(t), tangent = path.getTangent(t);
      const across = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, across).normalize();
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const p = center.clone().addScaledVector(across, Math.cos(angle) * width(t)).addScaledVector(normal, Math.sin(angle) * depth(t));
        positions.push(p.x, p.y, p.z);
        if (row < segments) {
          const i = base + row * sides + side, next = base + row * sides + (side + 1) % sides;
          indices.push(i, next, i + sides, next, next + sides, i + sides);
        }
      }
    }
    for (const row of [0, segments]) {
      const center = path.getPoint(row / segments), cap = positions.length / 3;
      positions.push(center.x, center.y, center.z);
      for (let side = 0; side < sides; side++) {
        const a = base + row * sides + side, b = base + row * sides + (side + 1) % sides;
        indices.push(cap, row ? a : b, row ? b : a);
      }
    }
  };
  // A light S-curve per side stays outside the mask/ear loops; its blade-like
  // cross-section and tapered tip avoid the former long round-strip silhouette.
  for (const sign of [-1, 1]) {
    const points = [[.078, 1.604, .037], [.094, 1.581, .032], [.105, 1.548, .027],
      [.106, 1.521, .034], [.097, 1.497, .040], [.092, 1.476, .031]]
      .map(([x, y, z]) => [sign * x, y + (sign < 0 ? .002 : 0), z]);
    sweep(points, 28, 8, t => (.0045 + .0013 * Math.sin(Math.PI * t)) * Math.pow(1 - t, .65) + .00015,
      t => .0021 * (1 - t) + .0001);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
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

/** Optional authored styling, separate from all base face/hair geometry and identity. */
function createBeautyStyling(head: THREE.BufferGeometry, upperLids: readonly THREE.BufferGeometry[]): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] {
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, transparent: true,
    depthWrite: false, depthTest: true, roughness: 1, metalness: 0, emissive: "#b78290", emissiveIntensity: .055 });
  const samplerMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const surface = new THREE.Mesh(head, samplerMaterial), ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, 0, -1);
  const patch = (y: number, halfWidth: number, halfHeight: number, color: string, opacity: number): THREE.BufferGeometry => {
    const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
    const tint = new THREE.Color(color), sides = 24, rings = 5;
    for (const sign of [-1, 1]) {
      const centerX = sign * (y > 1.57 ? .038 : .052), base = positions.length / 3;
      for (let row = 0; row <= rings; row++) {
        const r = row / rings, count = row ? sides : 1;
        for (let side = 0; side < count; side++) {
          const angle = side / sides * Math.PI * 2;
          ray.set(new THREE.Vector3(centerX + Math.cos(angle) * halfWidth * r, y + Math.sin(angle) * halfHeight * r, .2), direction);
          const hit = ray.intersectObject(surface)[0];
          if (!hit?.normal) throw Error("beauty surface");
          const point = hit.point.clone().addScaledVector(hit.normal, .00018);
          positions.push(point.x, point.y, point.z); normals.push(hit.normal.x, hit.normal.y, hit.normal.z);
          colors.push(tint.r, tint.g, tint.b, opacity * Math.pow(1 - r * r, 2));
        }
        if (!row) continue;
        const current = base + 1 + (row - 1) * sides;
        for (let side = 0; side < sides; side++) {
          const next = (side + 1) % sides;
          if (row === 1) indices.push(base, current + side, current + next);
          else {
            const previous = current - sides;
            indices.push(previous + side, current + side, current + next, previous + side, current + next, previous + next);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4)); geometry.setIndex(indices); return geometry;
  };
  let eyeTone: THREE.BufferGeometry, blush: THREE.BufferGeometry;
  try {
    eyeTone = patch(1.5845, .023, .009, "#c58b9b", .52);
    blush = patch(1.551, .022, .011, "#cf929d", .23);
  } finally { samplerMaterial.dispose(); }
  // Copy only the existing thin contour surface: no aperture change, wing or lashes.
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  const tint = new THREE.Color("#4f3e43"), normal = new THREE.Vector3();
  for (const lid of upperLids) {
    const p = lid.getAttribute("position"), n = lid.getAttribute("normal"), base = positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      normal.fromBufferAttribute(n, i);
      const point = new THREE.Vector3().fromBufferAttribute(p, i).addScaledVector(normal, .00008);
      const t = THREE.MathUtils.clamp((Math.abs(p.getX(i)) - .020) / .036, 0, 1);
      const fade = THREE.MathUtils.smoothstep(t, 0, .12) * (1 - THREE.MathUtils.smoothstep(t, .94, 1));
      const emphasis = .2 + .8 * THREE.MathUtils.smoothstep(t, .15, .65);
      positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z);
      colors.push(tint.r, tint.g, tint.b, .38 * fade * emphasis);
    }
    for (const index of lid.getIndex()!.array) indices.push(base + index);
  }
  const definition = new THREE.BufferGeometry();
  definition.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  definition.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  definition.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4)); definition.setIndex(indices);
  return [["EyeTone", eyeTone], ["UpperDefinition", definition], ["UpperCheek", blush]].map(([name, geometry]) => {
    const mesh = new THREE.Mesh(geometry as THREE.BufferGeometry, material); mesh.name = `NTS_Beauty_SoftRose_${name}`; return mesh;
  });
}



/** Owns the canonical source meshes until the caller transfers or disposes them. */
export async function loadCanonicalPresence(signal: AbortSignal) {
  const base = `${import.meta.env.BASE_URL}nts/`;
  const infoResponse = await fetch(`${base}presence-study.json`, { signal });
  if (!infoResponse.ok) throw Error("presence snapshot");
  const info = await infoResponse.json() as { objects: SnapshotObject[] };
  const response = await fetch(`${base}presence-study.bin`, { signal });
  if (!response.ok) throw Error("presence mesh");
  const buffer = await response.arrayBuffer();
  if (signal.aborted) throw new DOMException("Presence load cancelled", "AbortError");
  const presence = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let signature: THREE.Mesh | undefined;
  try {
      const palette: Record<string, string> = { skin: "#ecd6c6", hair: "#15191e", brow: "#332a29", lid: "#94776c", mask: "#eaf2f4", print: "#6d7b86", loop: "#cddce0", body: "#8ea7ad", eye: "#ffffff" };
      const shared = new Map<string, THREE.MeshStandardMaterial>();
      const materialRoles = new Map<THREE.Material, string>();
      const fringeSupport: THREE.BufferGeometry[] = [];
      const eyeSurfaces: THREE.BufferGeometry[] = [];
      const beautyLids: THREE.BufferGeometry[] = [];
      let maskSurface: THREE.BufferGeometry | undefined;
      for (const item of info.objects) {
        // Keep binary assets unchanged; bounded face refinements use cloned attributes.
        if (item.name === "NTS_2C_Hair_LowPonytail") continue;
        const geo = item.role === "print" ? mouseSignatureGeometry(maskSurface!) : new THREE.BufferGeometry();
        if (item.role !== "print") {
          for (const key of ["position", "normal", "color"] as const) if (item[key]) geo.setAttribute(key, new THREE.BufferAttribute(new Float32Array(buffer, item[key]!.offset, item[key]!.count), 3));
          geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, item.index.offset, item.index.count), 1));
        }
        geometries.add(geo);
        if (/^NTS_2C_(Eye|Lid_Upper|Lid_Lower)_[RL]$/.test(item.name)) softenEyeOpening(geo);
        if (item.name === "NTS_2C_Head_OriginalStylized") shortenChin(geo);
        if (item.role === "eye") eyeSurfaces.push(geo);
        if (/^NTS_2C_Lid_Upper_[RL]$/.test(item.name)) beautyLids.push(geo);
        if (["mask", "loop"].includes(item.role)) compactMask(geo, item.role === "loop");
        if (item.role === "mask") maskSurface = geo;
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
          shared.set(materialKey, material); materials.add(material); materialRoles.set(material, materialKey);
        }
        const mesh = new THREE.Mesh(geo, material); mesh.name = item.role === "print" ? MOUSE_SIGNATURE_NAME : item.name;
        if (item.role === "print") signature = mesh;
        if (item.role === "body") mesh.renderOrder = 1; presence.add(mesh);
      }
      const hairGeometry = softBunGeometry(); geometries.add(hairGeometry);
      const hair = new THREE.Mesh(hairGeometry, shared.get("hair")!); hair.name = "NTS_Hair_SoftRomanticBun"; presence.add(hair);
      const fringeGeometry = sideFringeGeometry(fringeSupport); geometries.add(fringeGeometry);
      const fringe = new THREE.Mesh(fringeGeometry, shared.get("hair")!); fringe.name = "NTS_Hair_SoftSideFringe"; presence.add(fringe);
      const catchlightGeometry = eyeCatchlightGeometry(eyeSurfaces); geometries.add(catchlightGeometry);
      const catchlightMaterial = new THREE.MeshBasicMaterial({ color: "#f5f7f1" }); materials.add(catchlightMaterial);
      materialRoles.set(catchlightMaterial, "catchlight");
      const catchlights = new THREE.Mesh(catchlightGeometry, catchlightMaterial); catchlights.name = "NTS_Eyes_StaticCatchlights"; presence.add(catchlights);
      for (const mesh of createBeautyStyling(fringeSupport[0], beautyLids)) {
        geometries.add(mesh.geometry); materials.add(mesh.material); materialRoles.set(mesh.material, "beauty"); presence.add(mesh);
      }

    const meshes = [...presence.children] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>[];
    return { presence, meshes, materialRoles, geometries, materials, signature,
      outfitMaterial: shared.get("body"), maskMaterial: shared.get("mask"),
      dispose() { geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); presence.clear(); } };
  } catch (error) {
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    throw error;
  }
}
