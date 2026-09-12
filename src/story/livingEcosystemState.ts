import type { StoryWorldDefinition } from "../world/world.schema";

export interface LivingEcosystemState {
  readonly open: boolean;
  readonly selectedNodeId?: string;
  readonly listOpen: boolean;
}

/** A presentation perspective, not a third story act or a new semantic model. */
export class LivingEcosystemController {
  private state: LivingEcosystemState = { open: false, listOpen: false };
  private readonly listeners = new Set<(state: LivingEcosystemState) => void>();
  constructor(private readonly world: StoryWorldDefinition) {}
  getState(): LivingEcosystemState { return this.state; }
  subscribe(listener: (state: LivingEcosystemState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  enter(): boolean {
    if (this.state.open) return false;
    return this.publish({ open: true, listOpen: false });
  }
  exit(): boolean {
    if (!this.state.open) return false;
    return this.publish({ open: false, listOpen: false });
  }
  select(nodeId?: string): boolean {
    if (!this.state.open || (nodeId && !this.world.nodes.some((node) => node.id === nodeId))) return false;
    const selectedNodeId = nodeId === this.state.selectedNodeId ? undefined : nodeId;
    if (selectedNodeId === this.state.selectedNodeId) return false;
    return this.publish({ ...this.state, selectedNodeId, listOpen: false });
  }
  setListOpen(listOpen: boolean): boolean {
    if (!this.state.open || this.state.listOpen === listOpen) return false;
    return this.publish({ ...this.state, listOpen });
  }
  private publish(state: LivingEcosystemState): boolean {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
    return true;
  }
}

export function relatedNodeIds(world: StoryWorldDefinition, selected?: string): Set<string> {
  const neighbors = new Set<string>();
  world.relationships.forEach(({ from, to }) => {
    if (from === selected) neighbors.add(to);
    if (to === selected) neighbors.add(from);
  });
  return neighbors;
}
