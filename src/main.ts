import "./styles/story-world.css";
import { observeReducedMotion, prefersReducedMotion } from "./platform/reducedMotion";
import { observeDocumentVisibility } from "./platform/visibility";
import { supportsWebGL } from "./platform/webglSupport";
import { StoryScene } from "./scene/StoryScene";
import { StoryController } from "./story/StoryController";
import type { StoryState } from "./story/storyState";
import { StoryOverlay } from "./ui/StoryOverlay";
import { STORY_WORLD_V0_1 } from "./world/world.v0.1";

declare global {
  interface Window {
    __MSXAI_STORY_WORLD__?: {
      inspect: () => ReturnType<StoryScene["getInspection"]> | { rendererType: "unavailable"; storyListFallback: true };
      selectNode: (nodeId: string) => void;
      destroy: () => void;
    };
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("MSxAI Story World needs an application root.");

const stage = document.createElement("section");
stage.className = "story-stage";
stage.dataset.testid = "story-stage";
app.append(stage);

const controller = new StoryController(STORY_WORLD_V0_1);
let scene: StoryScene | undefined;
let visible = !document.hidden;
const webglAvailable = supportsWebGL();

const overlay = new StoryOverlay(STORY_WORLD_V0_1, {
  beginStory: () => controller.beginStory(),
  exploreFreely: () => controller.exploreFreely(),
  resumeStory: () => controller.resumeStory(),
  next: () => controller.next(),
  back: () => controller.back(),
  resetView: () => scene?.resetCamera(),
  returnToHuman: () => controller.returnToHuman(),
  selectNode: (nodeId) => controller.selectNode(nodeId),
  setStoryListOpen: (open) => controller.setStoryListOpen(webglAvailable ? open : true),
  setAboutOpen: (open) => controller.setAboutOpen(open),
}, webglAvailable ? undefined : "3D Story View is unavailable in this browser. The accessible Story List remains fully available.");
stage.append(overlay.element);

if (webglAvailable) {
  scene = new StoryScene(stage, {
    world: STORY_WORLD_V0_1,
    reducedMotion: prefersReducedMotion(),
    onSelectNode: (nodeId) => controller.selectNode(nodeId),
    onRender: () => overlay.refreshLabels(),
  });
  overlay.setProjector((nodeId) => scene?.projectNode(nodeId) ?? { x: 0, y: 0, depth: 1, visible: false });
} else {
  controller.setStoryListOpen(true);
}

let previousState: StoryState | undefined;
const unsubscribe = controller.subscribe((state) => {
  const shouldMoveCamera = !previousState || previousState.beatIndex !== state.beatIndex || previousState.mode !== state.mode;
  scene?.present(state, shouldMoveCamera, !previousState);
  scene?.setActive(visible && !state.storyListOpen);
  overlay.render(state);
  previousState = state;
});

const stopReducedMotionObserver = observeReducedMotion((reduced) => scene?.setReducedMotion(reduced));
const stopVisibilityObserver = observeDocumentVisibility((nextVisible) => {
  visible = nextVisible;
  scene?.setActive(visible && !controller.getState().storyListOpen);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const state = controller.getState();
  if (state.aboutOpen) controller.setAboutOpen(false);
  else if (state.storyListOpen && webglAvailable) controller.setStoryListOpen(false);
});

function destroy(): void {
  unsubscribe();
  stopReducedMotionObserver();
  stopVisibilityObserver();
  scene?.dispose();
  scene = undefined;
}

if (import.meta.env.DEV) {
  window.__MSXAI_STORY_WORLD__ = {
    inspect: () => scene?.getInspection() ?? { rendererType: "unavailable", storyListFallback: true },
    selectNode: (nodeId) => controller.selectNode(nodeId),
    destroy,
  };
}

window.addEventListener("beforeunload", destroy, { once: true });
