import * as THREE from "three";

export const MOUSE_SIGNATURE_NAME = "NTS_Mask_MouseSignature";

/** Authored ink silhouette, not a font/emoji, sensor or animated indicator. */
export function mouseSignatureGeometry(mask: THREE.BufferGeometry): THREE.BufferGeometry {
  const face = new THREE.Shape();
  face.moveTo(0, -.55);
  face.bezierCurveTo(-.18, -.52, -.42, -.28, -.44, -.06);
  face.bezierCurveTo(-.82, -.03, -.92, .40, -.67, .61);
  face.bezierCurveTo(-.46, .79, -.15, .63, -.19, .36);
  face.quadraticCurveTo(0, .44, .19, .36);
  face.bezierCurveTo(.15, .63, .46, .79, .67, .61);
  face.bezierCurveTo(.92, .40, .82, -.03, .44, -.06);
  face.bezierCurveTo(.42, -.28, .18, -.52, 0, -.55);
  for (const [x, y, radius] of [[-.48, .36, .17], [.48, .36, .17], [-.18, .03, .055], [.18, .03, .055]]) {
    const hole = new THREE.Path(); hole.absellipse(x, y, radius, radius, 0, Math.PI * 2, true); face.holes.push(hole);
  }
  const shapes = [face];
  for (const side of [-1, 1]) for (const endY of [-.12, -.36]) {
    const a = new THREE.Vector2(side * .25, -.25), b = new THREE.Vector2(side * .70, endY);
    const normal = new THREE.Vector2(-(b.y - a.y), b.x - a.x).normalize().multiplyScalar(.018);
    const line = new THREE.Shape(); line.moveTo(a.x + normal.x, a.y + normal.y);
    line.lineTo(b.x + normal.x, b.y + normal.y); line.lineTo(b.x - normal.x, b.y - normal.y);
    line.lineTo(a.x - normal.x, a.y - normal.y); line.closePath(); shapes.push(line);
  }
  const flat = new THREE.ShapeGeometry(shapes, 8), positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const sampler = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), surface = new THREE.Mesh(mask, sampler);
  const ray = new THREE.Raycaster(), samples = new Map<string, { point: THREE.Vector3; normal: THREE.Vector3 }>();
  const vertex = (v: THREE.Vector3): void => {
    const x = .0415 + v.x * .0087, y = 1.5102 + v.y * .0087, key = `${x},${y}`;
    let sample = samples.get(key);
    if (!sample) {
      ray.set(new THREE.Vector3(x, y, .2), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(surface)[0]; if (!hit) throw Error("mouse signature mask surface");
      sample = { point: hit.point, normal: hit.normal ?? hit.face!.normal }; samples.set(key, sample);
    }
    positions.push(x, y, sample.point.z + .00012); normals.push(...sample.normal.toArray()); indices.push(indices.length);
  };
  try {
    // One bounded subdivision follows the mask curvature without a decal/texture.
    for (let i = 0; i < flat.index!.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(flat.attributes.position, flat.index!.getX(i + k)));
      const ab = a.clone().lerp(b, .5), bc = b.clone().lerp(c, .5), ca = c.clone().lerp(a, .5);
      for (const triangle of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) triangle.forEach(vertex);
    }
  } finally { flat.dispose(); sampler.dispose(); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); return geometry;
}
