import type { StoryMode } from "../world/world.schema";

export interface StoryState {
  readonly mode: StoryMode;
  readonly beatIndex: number;
  readonly selectedNodeId?: string;
  readonly entryOpen: boolean;
  readonly aboutOpen: boolean;
  readonly storyListOpen: boolean;
}

export const INITIAL_STORY_STATE: StoryState = {
  mode: "guided",
  beatIndex: 0,
  selectedNodeId: undefined,
  entryOpen: true,
  aboutOpen: false,
  storyListOpen: false,
};
