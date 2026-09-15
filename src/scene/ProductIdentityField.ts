import * as THREE from "three";
import { productIdentity } from "../world/productIdentity";

/** Static local signatures, created on demand. No particles, timers or live-data metaphor. */
export class ProductIdentityField {
  readonly group = new THREE.Group();
  private readonly signatures = new Map<string, THREE.Group>();
  constructor() { this.group.name = "presentation:product-identity"; this.group.visible = false; }

  select(id?: string, position?: THREE.Vector3, portrait = false): void {
    const identity = productIdentity(id);
    this.group.visible = Boolean(identity && position);
    this.signatures.forEach((signature) => { signature.visible = false; });
    if (!identity || !id || !position) return;
    let signature = this.signatures.get(id);
    if (!signature) {
      signature = new THREE.Group(); signature.name = `product-signature:${id}`;
      const line = (points: THREE.Vector3[], layer: number, opacity = .52) => {
        signature!.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: identity.colors[layer], transparent: true, opacity, depthWrite: false })));
      };
      if (id === "mss") {
        // Open, staggered context surfaces. No message content or simulated interface.
        for (let layer = 0; layer < 3; layer++) {
          const w = 1.8 - layer * .28, y = -.5 + layer * .58, z = (layer - 1) * .75;
          line([[-w + .4,y+.6,z],[w,y+.6,z],[w,y-.6,z],[-w,y-.6,z],[-w,y+.25,z]].map((p) => new THREE.Vector3(...p)), layer, .48 - layer * .06);
        }
      } else if (id === "wave-glass-project-h") {
        for (let layer = 0; layer < 3; layer++) {
          line(Array.from({ length: 57 }, (_, i) => {
            const x = -2.5 + i / 56 * 5;
            return new THREE.Vector3(x, Math.sin(x * 1.35 + layer * .4) * .27 + (layer - 1) * .27, (layer - 1) * .65);
          }), layer, .55 - layer * .09);
        }
      } else {
        for (let layer = 0; layer < 3; layer++) {
          const quiet = id === "mindhome", radius = quiet ? 1.8 + layer * .4 : 1.4 + layer * .38;
          const arc = quiet ? Math.PI * 1.65 : Math.PI * (1.1 + layer * .13);
          const rotation = new THREE.Euler(quiet ? -.9 + layer * .08 : .3 + layer * .75, layer * .35, quiet ? .05 : layer * .7);
          line(Array.from({ length: 65 }, (_, i) => {
            const angle = i / 64 * arc + layer * .85;
            return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * (quiet ? .62 : 1), 0).applyEuler(rotation);
          }), layer, quiet ? .28 - layer * .035 : .54 - layer * .06);
        }
      }
      this.signatures.set(id, signature); this.group.add(signature);
    }
    signature.visible = true;
    this.group.position.copy(position);
    this.group.scale.setScalar(portrait ? .82 : 1);
  }
  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Line) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
    this.group.removeFromParent(); this.group.clear(); this.signatures.clear(); this.group.visible = false;
  }
}
