import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MOUSE_SIGNATURE_NAME, mouseSignatureGeometry } from "../src/nts/mouseSignature";

// The Node test runtime has fs; keep its narrow test-only contract without adding Node typings.
const fsModule = "node:fs";
const { readFileSync } = await import(/* @vite-ignore */ fsModule) as {
  readFileSync(path: URL): Uint8Array<ArrayBuffer>;
  readFileSync(path: URL, encoding: "utf8"): string;
};

function canonicalCompactMask(): THREE.BufferGeometry {
  const info = JSON.parse(readFileSync(new URL("../public/nts/presence-study.json", import.meta.url), "utf8")) as {
    objects: Array<{ role: string; position: { offset: number; count: number }; normal: { offset: number; count: number }; index: { offset: number; count: number } }>;
  };
  const item = info.objects.find(object => object.role === "mask")!;
  const bin = readFileSync(new URL("../public/nts/presence-study.bin", import.meta.url));
  const geometry = new THREE.BufferGeometry();
  for (const key of ["position", "normal"] as const) geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(bin.buffer, bin.byteOffset + item[key].offset, item[key].count).slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bin.buffer, bin.byteOffset + item.index.offset, item.index.count).slice(), 1));
  // Canonical compact-mask presentation transform; the binary itself remains untouched.
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setY(i, 1.5038676 + .78 * (positions.getY(i) - 1.5038676));
  geometry.computeVertexNormals(); return geometry;
}

describe("Deterministic authored mouse signature geometry", () => {
  it("creates one small finite silhouette without modifying the supplied mask", () => {
    const mask = canonicalCompactMask(), original = mask.attributes.position.array.slice();
    const first = mouseSignatureGeometry(mask), second = mouseSignatureGeometry(mask);
    try {
      expect(MOUSE_SIGNATURE_NAME).toBe("NTS_Mask_MouseSignature");
      expect(first.index!.count / 3).toBe(552);
      expect(first.attributes.position.array).toEqual(second.attributes.position.array);
      expect(first.attributes.normal.array).toEqual(second.attributes.normal.array);
      expect(first.index!.array).toEqual(second.index!.array);
      expect(mask.attributes.position.array).toEqual(original);
      expect([...first.attributes.position.array].every(Number.isFinite)).toBe(true);
      expect([...first.attributes.normal.array].every(Number.isFinite)).toBe(true);
      const size = first.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(.01); expect(size.x).toBeLessThan(.02);
      expect(size.y).toBeGreaterThan(.008); expect(size.y).toBeLessThan(.015);
    } finally { mask.dispose(); first.dispose(); second.dispose(); }
  });

  it("keeps vertices and triangle interiors just above the actual canonical curved mask", () => {
    const mask = canonicalCompactMask(), signature = mouseSignatureGeometry(mask);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), surface = new THREE.Mesh(mask, material);
    const ray = new THREE.Raycaster(), positions = signature.attributes.position, index = signature.index!;
    const gaps: number[] = [];
    const sample = (point: THREE.Vector3) => {
      ray.set(new THREE.Vector3(point.x, point.y, .2), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(surface)[0];
      expect(hit, "mouse silhouette stays on the mask surface").toBeDefined();
      gaps.push(point.z - hit.point.z);
    };
    try {
      for (let i = 0; i < positions.count; i++) sample(new THREE.Vector3().fromBufferAttribute(positions, i));
      for (let i = 0; i < index.count; i += 3) {
        const triangle = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + k)));
        for (const [a, b, c] of [[1/3, 1/3, 1/3], [.5, .25, .25], [.25, .5, .25], [.25, .25, .5], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]]) {
          sample(triangle[0].clone().multiplyScalar(a).addScaledVector(triangle[1], b).addScaledVector(triangle[2], c));
        }
      }
      expect(Math.min(...gaps)).toBeGreaterThan(0);
      expect(Math.max(...gaps)).toBeLessThan(.0002);
    } finally { mask.dispose(); signature.dispose(); material.dispose(); }
  });

  it("rejects unsupported placement instead of producing a floating signature", () => {
    const missingSurface = new THREE.PlaneGeometry(.01, .01).translate(2, 2, 0);
    try { expect(() => mouseSignatureGeometry(missingSurface)).toThrow("mouse signature mask surface"); }
    finally { missingSurface.dispose(); }
  });
});
