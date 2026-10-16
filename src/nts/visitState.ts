import { MEMORIES, type MemoryId } from "./content";
import { DEFAULT_APPEARANCE, MASK_COLORS, OUTFIT_COLORS, type MaskColor, type OutfitColor, type PresenceMode } from "./appearance";
export interface NtsState {
  readonly phase: "closed" | "approaching" | "settled" | "returning";
  readonly memoryId: MemoryId;
  readonly reading: boolean;
  readonly inspection: false | "front" | "left" | "right" | number;
  readonly markInspection: boolean;
  readonly introduction: boolean;
  readonly dom: boolean;
  readonly outfit: OutfitColor;
  readonly mask: MaskColor;
  readonly presentation: PresenceMode;
}
/** Only presentation state. No story/ecosystem/model/context references. */
export class NtsVisitController {
  private state: NtsState = { phase: "closed", memoryId: "s1", reading: false, inspection: false, markInspection: false, introduction: false, dom: false, presentation: "normal", ...DEFAULT_APPEARANCE };
  private readonly listeners = new Set<(state: NtsState) => void>();
  getState(): NtsState { return this.state; }
  get active(): boolean { return this.state.phase !== "closed"; }
  subscribe(listener: (state: NtsState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  enter(reduced: boolean): boolean {
    if (this.active) return false;
    this.publish({ ...this.state, ...DEFAULT_APPEARANCE, presentation: "normal", phase: reduced ? "settled" : "approaching", memoryId: "s1", reading: false, inspection: false, markInspection: false, introduction: false }); return true;
  }
  settle(): void { if (this.state.phase === "approaching") this.publish({ ...this.state, phase: "settled" }); }
  select(id: MemoryId): void {
    if (this.state.phase !== "settled" || !MEMORIES.some(item => item.id === id)) return;
    this.publish({ ...this.state, memoryId: id, reading: true, inspection: false, markInspection: false, introduction: false });
  }
  inspect(view: "front" | "left" | "right" | false | number): void {
    if (typeof view === "number") view = Number.isFinite(view) ? Math.max(-90, Math.min(90, view)) || "front" : "front";
    if (this.state.phase === "settled") this.publish({ ...this.state, inspection: view, markInspection: false, introduction: false });
  }
  inspectMark(active: boolean): void {
    if (this.state.phase === "settled" && (!active || (!this.state.dom && !this.state.introduction)) && active !== this.state.markInspection) this.publish({ ...this.state, markInspection: active });
  }
  introduce(): void { if (this.state.phase === "settled" && !this.state.introduction) this.publish({ ...this.state, markInspection: false, introduction: true }); }
  closeIntroduction(): void { if (this.state.introduction) this.publish({ ...this.state, introduction: false }); }
  closeReading(): void { if (this.state.reading) this.publish({ ...this.state, reading: false }); }
  setDom(dom: boolean): void { this.publish({ ...this.state, dom, markInspection: dom ? false : this.state.markInspection }); }
  setOutfit(outfit: OutfitColor): void {
    if (this.state.phase === "settled" && Object.hasOwn(OUTFIT_COLORS, outfit) && outfit !== this.state.outfit) this.publish({ ...this.state, outfit });
  }
  setMask(mask: MaskColor): void {
    if (this.state.phase === "settled" && Object.hasOwn(MASK_COLORS, mask) && mask !== this.state.mask) this.publish({ ...this.state, mask });
  }
  setPresentation(presentation: PresenceMode): void {
    if (this.state.phase === "settled" && ["normal", "hologram"].includes(presentation) && presentation !== this.state.presentation) this.publish({ ...this.state, presentation });
  }
  requestReturn(): void {
    if (this.active && this.state.phase !== "returning") this.publish({ ...this.state, phase: "returning", inspection: false, markInspection: false, introduction: false, reading: false });
  }
  finishReturn(): void { if (this.state.phase === "returning") this.publish({ ...this.state, phase: "closed" }); }
  /** One command affects one top layer; the caller consumes the keyboard event. */
  escape(): boolean {
    if (!this.active) return false;
    if (this.state.markInspection) this.inspectMark(false);
    else if (this.state.introduction) this.closeIntroduction();
    else if (this.state.inspection) this.inspect(false);
    else if (this.state.reading) this.closeReading();
    else this.requestReturn();
    return true;
  }
  dispose(): void { this.listeners.clear(); }
  private publish(state: NtsState): void { this.state = state; this.listeners.forEach(listener => listener(state)); }
}
