export type NutuensaiStorySource = "home" | "human";
export interface NutuensaiJourneyState {
  readonly phase: "idle" | "requested" | "travelling" | "recognition" | "arrived" | "cancelled";
  readonly leg?: "ecosystem" | "nutuensai";
  readonly source?: NutuensaiStorySource;
  readonly requestId: number;
  readonly visitRequests: number;
}
/** Destination handoff contract for a future NTS presentation, not StoryState. */
export interface NtsVisitRequest {
  readonly requestId: number;
  readonly source: NutuensaiStorySource;
  readonly nodeId: "nutuensai";
  readonly returnContext: { readonly mode: "living-ecosystem"; readonly selectedNodeId: "nutuensai" };
}

/** An explicit authored intent. Ordinary node selection has no reference to it. */
export class NutuensaiStoryJourney {
  private state: NutuensaiJourneyState = { phase: "idle", requestId: 0, visitRequests: 0 };
  private readonly listeners = new Set<(state: NutuensaiJourneyState) => void>();
  getState(): NutuensaiJourneyState { return this.state; }
  get active(): boolean { return ["requested", "travelling", "recognition"].includes(this.state.phase); }
  subscribe(listener: (state: NutuensaiJourneyState) => void): () => void {
    this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener);
  }
  request(source: NutuensaiStorySource): boolean {
    if (this.active) return false;
    this.publish({ phase: "requested", source, requestId: this.state.requestId + 1, visitRequests: this.state.visitRequests });
    return true;
  }
  travel(): void { if (this.state.phase === "requested") this.publish({ ...this.state, phase: "travelling", leg: "ecosystem" }); }
  focus(): void { if (this.state.phase === "travelling" && this.state.leg === "ecosystem") this.publish({ ...this.state, leg: "nutuensai" }); }
  recognize(): void { if (this.state.phase === "travelling" && this.state.leg === "nutuensai") this.publish({ ...this.state, phase: "recognition" }); }
  consumeVisit(): NtsVisitRequest | undefined {
    if (this.state.phase !== "recognition" || !this.state.source) return;
    const request: NtsVisitRequest = { requestId: this.state.requestId, source: this.state.source, nodeId: "nutuensai", returnContext: { mode: "living-ecosystem", selectedNodeId: "nutuensai" } };
    // Consume before handing off, so returning to this selection cannot replay it.
    this.publish({ ...this.state, phase: "arrived", visitRequests: this.state.visitRequests + 1 });
    return request;
  }
  cancel(): void { if (this.active) this.publish({ ...this.state, phase: "cancelled" }); }
  reset(): void {
    if (this.state.phase !== "idle") this.publish({ phase: "idle", requestId: this.state.requestId, visitRequests: this.state.visitRequests });
  }
  dispose(): void { this.listeners.clear(); }
  private publish(state: NutuensaiJourneyState): void { this.state = state; this.listeners.forEach(listener => listener(state)); }
}
