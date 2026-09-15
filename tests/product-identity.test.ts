import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PRODUCT_IDENTITIES, productIdentity } from "../src/world/productIdentity";
import { ProductIdentityField } from "../src/scene/ProductIdentityField";
import { STORY_WORLD_V0_1 as world } from "../src/world/world.v0.1";

describe("Product identity is bounded editorial presentation", () => {
  it("covers only the four product IDs, with local bilingual purpose and agency copy", () => {
    expect(Object.keys(PRODUCT_IDENTITIES)).toEqual(["mss", "mindhome", "mhb", "wave-glass-project-h"]);
    for (const id of Object.keys(PRODUCT_IDENTITIES)) {
      expect(world.nodes.find((node) => node.id === id)?.kind).toBe("ecosystem-anchor");
      const product = productIdentity(id)!;
      expect(product.mark).not.toMatch(/^https?:/);
      for (const locale of ["en", "th"] as const) {
        for (const text of Object.values(product.copy[locale])) expect(text.length).toBeGreaterThan(5);
      }
    }
    for (const id of ["human", "intention", "msxai", "nutuensai", "lli", "toString", "missing"]) expect(productIdentity(id)).toBeUndefined();
  });
  it("creates at most three curves per selected product and reuses them, without changing node data", () => {
    const before = JSON.stringify(world);
    const field = new ProductIdentityField();
    expect(field.group.visible).toBe(false); expect(field.group.children).toHaveLength(0);
    const point = new THREE.Vector3(2, 3, 4);
    for (const id of Object.keys(PRODUCT_IDENTITIES)) {
      field.select(id, point);
      expect(field.group.position.toArray()).toEqual(point.toArray());
      expect(field.group.children.filter((child) => child.visible)).toHaveLength(1);
      const signature = field.group.getObjectByName(`product-signature:${id}`)!;
      expect(signature.children).toHaveLength(3);
      const first = signature.children[0];
      field.select(id, point, true);
      expect(field.group.getObjectByName(`product-signature:${id}`)!.children[0]).toBe(first);
      expect(field.group.scale.x).toBe(.82);
    }
    expect(JSON.stringify(world)).toBe(before);
    field.select("human", point); expect(field.group.visible).toBe(false);
    field.select(); expect(field.group.visible).toBe(false);
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    field.group.traverse((object) => {
      if (object instanceof THREE.Line) {
        disposals.push(vi.spyOn(object.geometry, "dispose"), vi.spyOn(object.material as THREE.Material, "dispose"));
      }
    });
    field.dispose(); expect(field.group.children).toHaveLength(0);
    disposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
});
