import "./styles/story-world.css";
import { InteractionSound } from "./audio/interactionSound";
import { observeReducedMotion, prefersReducedMotion } from "./platform/reducedMotion";
import { observeDocumentVisibility } from "./platform/visibility";
import { supportsWebGL } from "./platform/webglSupport";
import { StoryScene } from "./scene/StoryScene";
import { StoryController } from "./story/StoryController";
import { LocaleController } from "./story/localeState";
import type { StoryState } from "./story/storyState";
import { UI_COPY } from "./i18n";
import { StoryOverlay } from "./ui/StoryOverlay";
import { LivingEcosystemController, type LivingEcosystemState } from "./story/livingEcosystemState";
import { LivingEcosystemView } from "./ui/LivingEcosystemView";
import { STORY_WORLD_V0_1 } from "./world/world.v0.1";

declare global {
  interface Window {
    __MSXAI_STORY_WORLD__?: {
      inspect: () => (ReturnType<StoryScene["getInspection"]> | { rendererType: "unavailable"; storyListFallback: true }) & { overviewState: LivingEcosystemState; storyState: StoryState };
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
const ecosystem = new LivingEcosystemController(STORY_WORLD_V0_1);
const localeController = new LocaleController();
const interactionSound = new InteractionSound();
let scene: StoryScene | undefined;
let visible = !document.hidden;
const webglAvailable = supportsWebGL();
const feedback = (accepted: boolean): void => { if (accepted) interactionSound.playInteractionSound(); };
const selectEcosystem = (id?: string): void => { feedback(ecosystem.select(id)); };
let returnFocus: HTMLElement | null = null;

const overlay = new StoryOverlay(STORY_WORLD_V0_1, {
  enterEcosystem: () => { feedback(ecosystem.enter()); },
  beginStory: () => controller.beginStory(),
  exploreFreely: () => controller.exploreFreely(),
  resumeStory: () => controller.resumeStory(),
  next: () => controller.next(),
  back: () => controller.back(),
  resetView: () => scene?.resetCamera(),
  returnToHuman: () => controller.returnToHuman(),
  selectNode: (nodeId) => controller.selectNode(nodeId),
  setStoryListOpen: (open) => {
    if (ecosystem.getState().open) ecosystem.setListOpen(open);
    else controller.setStoryListOpen(webglAvailable ? open : true);
  },
  setAboutOpen: (open) => controller.setAboutOpen(open),
  setLocale: (locale) => localeController.setLocale(locale),
  enableSound: () => interactionSound.enableSound(),
  disableSound: () => interactionSound.disableSound(),
  isSoundEnabled: () => interactionSound.isSoundEnabled(),
  playInteractionSound: () => { interactionSound.playInteractionSound(); },
}, webglAvailable ? undefined : { en: UI_COPY.en.unavailable3d, th: UI_COPY.th.unavailable3d });
stage.append(overlay.element);
const ecosystemView = new LivingEcosystemView(STORY_WORLD_V0_1, {
  select: selectEcosystem,
  exit: () => { feedback(ecosystem.exit()); },
  closeList: () => { feedback(ecosystem.setListOpen(false)); },
  project: (id) => scene?.projectNode(id),
}, !webglAvailable);
overlay.element.append(ecosystemView.element);

if (webglAvailable) {
  scene = new StoryScene(stage, {
    world: STORY_WORLD_V0_1,
    reducedMotion: prefersReducedMotion(),
    onSelectNode: (nodeId) => {
      if (ecosystem.getState().open) selectEcosystem(nodeId);
      else controller.selectNode(nodeId);
    },
    onClearSelection: () => selectEcosystem(),
    onRender: () => { overlay.refreshLabels(); ecosystemView.refreshLabels(); },
  });
  overlay.setProjector((nodeId) => scene?.projectNode(nodeId) ?? { x: 0, y: 0, depth: 1, visible: false });
} else {
  controller.setStoryListOpen(true);
}

let previousState: StoryState | undefined;
const unsubscribe = controller.subscribe((state) => {
  const shouldMoveCamera = !previousState || previousState.beatIndex !== state.beatIndex || previousState.mode !== state.mode;
  scene?.present(state, shouldMoveCamera, !previousState);
  scene?.setActive(visible && !(ecosystem.getState().open ? ecosystem.getState().listOpen : state.storyListOpen));
  overlay.render(state);
  previousState = state;
});

let ecosystemWasOpen = false;
const unsubscribeEcosystem = ecosystem.subscribe((state) => {
  if (state.open && !ecosystemWasOpen) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  scene?.setEcosystemOpen(state.open);
  scene?.selectEcosystemNode(state.selectedNodeId);
  overlay.element.classList.toggle("is-ecosystem", state.open);
  ecosystemView.render(state);
  scene?.setActive(visible && !(state.open ? state.listOpen : controller.getState().storyListOpen));
  if (state.open && !ecosystemWasOpen) ecosystemView.focusHeading();
  if (!state.open && ecosystemWasOpen) {
    overlay.render(controller.getState());
    returnFocus?.focus({ preventScroll: true });
  }
  ecosystemWasOpen = state.open;
});

const stopReducedMotionObserver = observeReducedMotion((reduced) => scene?.setReducedMotion(reduced));
const stopVisibilityObserver = observeDocumentVisibility((nextVisible) => {
  visible = nextVisible;
  scene?.setActive(visible && !(ecosystem.getState().open ? ecosystem.getState().listOpen : controller.getState().storyListOpen));
  interactionSound.setPageVisible(nextVisible);
});
const unsubscribeLocale = localeController.subscribe((locale) => { overlay.setLocale(locale); ecosystemView.setLocale(locale); });

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== "Escape") return;
  const state = controller.getState();
  if (state.aboutOpen) controller.setAboutOpen(false);
  else if (ecosystem.getState().open) {
    if (ecosystem.getState().listOpen) feedback(ecosystem.setListOpen(false));
    else if (ecosystem.getState().selectedNodeId) selectEcosystem();
    else feedback(ecosystem.exit());
  }
  else if (state.storyListOpen && webglAvailable) controller.setStoryListOpen(false);
};
window.addEventListener("keydown", onKeyDown);

function destroy(): void {
  unsubscribe();
  unsubscribeEcosystem();
  window.removeEventListener("keydown", onKeyDown);
  unsubscribeLocale();
  stopReducedMotionObserver();
  stopVisibilityObserver();
  scene?.dispose();
  scene = undefined;
  interactionSound.dispose();
}

if (import.meta.env.DEV) {
  window.__MSXAI_STORY_WORLD__ = {
    inspect: () => ({ ...(scene?.getInspection() ?? { rendererType: "unavailable" as const, storyListFallback: true as const }), overviewState: ecosystem.getState(), storyState: controller.getState() }),
    selectNode: (nodeId) => { if (ecosystem.getState().open) selectEcosystem(nodeId); else controller.selectNode(nodeId); },
    destroy,
  };
}

window.addEventListener("beforeunload", destroy, { once: true });
