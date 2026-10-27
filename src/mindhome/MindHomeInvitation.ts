import * as THREE from "three";
import { loadCanonicalPresence } from "../nts/canonicalPresence";
import { EnergyGraphPresence } from "../nts/hologram";
import { PROJECTION_TIMING, projectionEnvelope, SpatialProjection } from "../nts/spatialProjection";

type Phase = "quiet" | "inviting" | "active" | "dismissing";
type CanonicalPresence = Awaited<ReturnType<typeof loadCanonicalPresence>>;
const IMAGE_ASPECT = 1672 / 941;

/** One visit owns one optional symbolic presence; rendering stays with StoryScene. */
export class MindHomeInvitation {
  private phase: Phase = "quiet";
  private graph?: EnergyGraphPresence;
  private projection?: SpatialProjection;
  private source?: CanonicalPresence;
  private started?: number;
  private request?: AbortController;
  private generation = 0;
  private disposed = false;
  private visible = true;
  private busy = false;
  private failed = false;
  private stageHeight = 900;
  private pixelRatio = 1;
  private modelBounds?: THREE.Box3;
  private displayWidth = 0;
  private displayHeight = 0;

  constructor(private readonly scene: THREE.Scene, private readonly invalidate: () => void, private reducedMotion: boolean) {}

  toggle(): boolean {
    if (this.disposed) return false;
    if (this.phase !== "quiet") return this.dismiss();
    if (this.busy) return false;
    this.phase = "inviting"; this.failed = false; this.invalidate();
    if (this.graph) { this.start(); return true; }
    const request = new AbortController(); this.request = request;
    const generation = ++this.generation;
    void loadCanonicalPresence(request.signal).then(source => {
      if (this.disposed || request.signal.aborted || generation !== this.generation || this.phase !== "inviting") {
        source.dispose(); return;
      }
      this.request = undefined;
      let graph: EnergyGraphPresence | undefined;
      let projection: SpatialProjection | undefined;
      try {
        graph = new EnergyGraphPresence(source.meshes, source.materialRoles, this.invalidate);
        projection = new SpatialProjection(source.meshes);
        this.source = source; this.graph = graph; this.projection = projection;
        this.modelBounds = new THREE.Box3().setFromObject(graph.group);
        this.place();
        this.scene.add(graph.group, projection.group);
        this.updateAppearance();
        this.start();
      } catch {
        graph?.dispose(); projection?.dispose(); source.dispose();
        this.source = undefined; this.graph = undefined; this.projection = undefined;
        this.phase = "quiet"; this.failed = true; this.invalidate();
      }
    }).catch(() => {
      if (this.disposed || request.signal.aborted || generation !== this.generation) return;
      this.request = undefined; this.phase = "quiet"; this.failed = true; this.invalidate();
    });
    return true;
  }

  dismiss(): boolean {
    if (this.disposed || this.phase === "quiet") return false;
    if (this.phase === "dismissing") return false;
    if (this.phase === "inviting") {
      this.cancelRequest(); this.settle("quiet"); return true;
    }
    this.phase = "dismissing"; this.graph?.pulse.setEligible(false);
    this.start(); return true;
  }

  private cancelRequest(): void {
    this.generation++; this.request?.abort(); this.request = undefined;
  }

  private place(): void {
    if (!this.graph || !this.projection || !this.modelBounds) return;
    const bounds = this.modelBounds;
    const size = bounds.getSize(new THREE.Vector3());
    // Keep the figure in the same part of the pavilion, with a smaller
    // photographic footprint on compact stages.
    this.displayHeight = THREE.MathUtils.lerp(.21, .24, THREE.MathUtils.clamp((this.stageHeight - 220) / 400, 0, 1));
    const scale = this.displayHeight / Math.max(size.y, .001);
    this.displayWidth = size.x * scale / IMAGE_ASPECT;
    const x = .64 - (bounds.min.x + bounds.max.x) * .5 * scale / IMAGE_ASPECT;
    const y = .45 - (bounds.min.y + bounds.max.y) * .5 * scale;
    for (const group of [this.graph.group, this.projection.group]) {
      group.position.set(x, y, .12);
      group.scale.set(scale / IMAGE_ASPECT, scale, scale / IMAGE_ASPECT);
      group.traverse(object => { object.renderOrder = 10; });
    }
  }

  private start(): void {
    if (!this.graph || !this.projection) return;
    this.graph.pulse.setEligible(false);
    if (this.reducedMotion || !this.visible || this.busy) {
      this.settle(this.phase === "inviting" ? "active" : "quiet"); return;
    }
    this.graph.setMode("hologram");
    this.started = performance.now(); this.update(this.started); this.invalidate();
  }

  private settle(phase: "quiet" | "active"): void {
    this.started = undefined; this.phase = phase;
    this.projection?.reset();
    this.graph?.setMode(phase === "active" ? "hologram" : "normal");
    this.graph?.clearTransitionMix();
    this.refreshPulse(); this.invalidate();
  }

  private refreshPulse(): void {
    this.graph?.pulse.setEligible(!this.disposed && this.visible && !this.busy && !this.reducedMotion && this.phase === "active");
  }

  update(now: number): boolean {
    if (this.disposed || !this.visible) return false;
    if (this.started !== undefined && this.graph && this.projection) {
      const elapsed = Math.max(0, now - this.started);
      if (elapsed >= PROJECTION_TIMING.duration) this.settle(this.phase === "inviting" ? "active" : "quiet");
      else {
        const envelope = projectionEnvelope(elapsed);
        this.graph.setTransitionMix(false, this.phase === "inviting" ? envelope.destination : envelope.source);
        this.projection.apply(elapsed);
        return true;
      }
    }
    this.graph?.pulse.frame(now);
    return Boolean(this.graph?.pulse.animating);
  }

  setReducedMotion(reduced: boolean): void {
    if (this.disposed || reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (reduced && this.started !== undefined) this.settle(this.phase === "inviting" ? "active" : "quiet");
    else this.refreshPulse();
  }

  setVisible(visible: boolean): void {
    if (this.disposed || visible === this.visible) return;
    this.visible = visible;
    if (!visible && this.started !== undefined) this.settle(this.phase === "inviting" ? "active" : "quiet");
    else this.refreshPulse();
    if (visible) this.invalidate();
  }

  setBusy(busy: boolean): void {
    if (this.disposed || busy === this.busy) return;
    this.busy = busy;
    if (busy && this.started !== undefined) this.settle(this.phase === "inviting" ? "active" : "quiet");
    else this.refreshPulse();
  }

  resize(stageHeight: number, ratio: number): void {
    const changed = Math.abs(stageHeight - this.stageHeight) > .25;
    this.stageHeight = stageHeight; this.pixelRatio = ratio;
    if (changed) this.place();
    this.updateAppearance();
  }

  private updateAppearance(): void {
    this.graph?.resize(this.stageHeight, this.pixelRatio);
    const compact = THREE.MathUtils.clamp((this.stageHeight - 220) / 400, 0, 1);
    this.graph?.setContextPointScale(THREE.MathUtils.lerp(.23, .55, compact));
    this.graph?.setContextOpacity(THREE.MathUtils.lerp(.24, .55, compact));
  }

  get inspection() {
    return { phase: this.phase, loading: Boolean(this.request), failed: this.failed,
      graph: this.graph?.inspection, projection: this.projection?.inspection, pulse: this.graph?.pulse.inspection,
      sourceResources: { geometries: this.source?.geometries.size ?? 0, materials: this.source?.materials.size ?? 0 },
      display: { x: .64, y: .55, width: this.displayWidth, height: this.displayHeight } };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.cancelRequest(); this.started = undefined;
    this.graph?.dispose(); this.projection?.dispose(); this.source?.dispose();
    this.graph = undefined; this.projection = undefined; this.source = undefined;
    this.phase = "quiet";
  }
}
