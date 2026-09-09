import type { StoryWorldDefinition } from "../world/world.schema";
import type { StoryState } from "./storyState";
import { INITIAL_STORY_STATE } from "./storyState";

export type StoryListener = (state: StoryState) => void;

/**
 * Story-only state. This controller owns no operational state and deliberately
 * exposes no navigation, storage, source, or model-request capability.
 */
export class StoryController {
  private state: StoryState = INITIAL_STORY_STATE;
  private readonly listeners = new Set<StoryListener>();

  public constructor(readonly world: StoryWorldDefinition) {}

  public getState(): StoryState {
    return this.state;
  }

  public subscribe(listener: StoryListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public beginStory(): void {
    this.setState({ mode: "guided", beatIndex: 1, selectedNodeId: "human", entryOpen: false });
  }

  public exploreFreely(): void {
    this.setState({ mode: "free", entryOpen: false });
  }

  public resumeStory(): void {
    this.setState({ mode: "guided", entryOpen: false });
  }

  public next(): void {
    const nextIndex = Math.min(this.state.beatIndex + 1, this.world.beats.length - 1);
    const nextBeat = this.world.beats[nextIndex];
    this.setState({
      beatIndex: nextIndex,
      selectedNodeId: nextBeat.focusNodeId ?? this.state.selectedNodeId,
      entryOpen: false,
    });
  }

  public back(): void {
    const previousIndex = Math.max(this.state.beatIndex - 1, 0);
    const beat = this.world.beats[previousIndex];
    this.setState({
      beatIndex: previousIndex,
      selectedNodeId: beat.focusNodeId,
      entryOpen: false,
    });
  }

  public selectNode(nodeId: string): void {
    if (!this.world.nodes.some((node) => node.id === nodeId)) return;
    this.setState({ selectedNodeId: nodeId, entryOpen: false });
  }

  public returnToHuman(): void {
    this.setState({ mode: "guided", beatIndex: 1, selectedNodeId: "human", entryOpen: false });
  }

  public resetView(): void {
    const beat = this.world.beats[this.state.beatIndex];
    this.setState({ selectedNodeId: beat.focusNodeId });
  }

  public setStoryListOpen(open: boolean): void {
    this.setState({ storyListOpen: open });
  }

  public setAboutOpen(open: boolean): void {
    this.setState({ aboutOpen: open });
  }

  public closeEntry(): void {
    this.setState({ entryOpen: false });
  }

  private setState(patch: Partial<StoryState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
