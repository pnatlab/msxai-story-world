import "./styles/story-world.css";
import "./styles/foundational-opening.css";
import "./styles/product-identity.css";
import "./styles/nts.css";
import { NtsVisitController, type NtsState } from "./nts/visitState";
import { NtsView } from "./nts/NtsView";
import { FoundationalOpening } from "./ui/FoundationalOpening";
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
import { NutuensaiStoryJourney, type NutuensaiJourneyState, type NutuensaiStorySource, type NtsVisitRequest } from "./story/nutuensaiStoryJourney";
import { STORY_WORLD_V0_1 } from "./world/world.v0.1";

declare global {
  interface Window {
    __MSXAI_STORY_WORLD__?: {
      inspect: () => (ReturnType<StoryScene["getInspection"]> | { rendererType: "unavailable"; storyListFallback: true }) & { overviewState: LivingEcosystemState; storyState: StoryState; journeyState: NutuensaiJourneyState; ntsVisitRequest?: NtsVisitRequest; ntsState: NtsState };
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
const nutuensaiJourney = new NutuensaiStoryJourney();
const nts = new NtsVisitController();
const localeController = new LocaleController();
const interactionSound = new InteractionSound();
let scene: StoryScene | undefined;
let destroyed = false;
let visible = !document.hidden;
const webglAvailable = supportsWebGL();
if (!webglAvailable) nts.setDom(true);
const feedback = (accepted: boolean): void => { if (accepted) interactionSound.playInteractionSound(); };
const selectEcosystem = (id?: string): void => {
  if (nutuensaiJourney.active || nts.active) return;
  nutuensaiJourney.reset(); scene?.releaseNutuensaiJourneyFocus(); feedback(ecosystem.select(id));
};
let recognitionTimer: ReturnType<typeof setTimeout> | undefined;
let recognitionReadyAt = 0;
let lastNtsVisitRequest: NtsVisitRequest | undefined;
let returnFocus: HTMLElement | null = null;
let requestedReturnFocus: HTMLButtonElement | null = null;
let opening: FoundationalOpening;

const overlay = new StoryOverlay(STORY_WORLD_V0_1, {
  enterEcosystem: () => { nutuensaiJourney.reset(); feedback(ecosystem.enter()); },
  startNutuensaiStory,
  beginStory: () => controller.beginStory(),
  exploreFreely: () => controller.exploreFreely(),
  resumeStory: () => controller.resumeStory(),
  next: () => controller.next(),
  back: () => controller.back(),
  resetView: () => scene?.resetCamera(),
  returnToHuman: () => controller.returnToHuman(),
  selectNode: (nodeId) => controller.selectNode(nodeId),
  setStoryListOpen: (open) => {
    if (open && nutuensaiJourney.active) cancelNutuensaiJourney(true);
    if (ecosystem.getState().open) ecosystem.setListOpen(open);
    else controller.setStoryListOpen(webglAvailable ? open : true);
  },
  setAboutOpen: (open) => { if (open && nutuensaiJourney.active) cancelNutuensaiJourney(true); controller.setAboutOpen(open); },
  replayOpening: (trigger) => {
    overlay.setAboutReplaySuspended(true);
    opening = new FoundationalOpening(stage, overlay.element, prefersReducedMotion(), {
      replay: true,
      returnFocus: trigger,
      onFinish: () => overlay.setAboutReplaySuspended(false),
    });
    opening.setLocale(localeController.getLocale());
  },
  setLocale: (locale) => localeController.setLocale(locale),
  enableSound: () => interactionSound.enableSound(),
  disableSound: () => interactionSound.disableSound(),
  isSoundEnabled: () => interactionSound.isSoundEnabled(),
  playInteractionSound: () => { interactionSound.playInteractionSound(); },
}, webglAvailable ? undefined : { en: UI_COPY.en.unavailable3d, th: UI_COPY.th.unavailable3d });
stage.append(overlay.element);
const ecosystemView = new LivingEcosystemView(STORY_WORLD_V0_1, {
  select: selectEcosystem,
  exit: () => { cancelNutuensaiJourney(false); nutuensaiJourney.reset(); feedback(ecosystem.exit()); },
  closeList: () => { feedback(ecosystem.setListOpen(false)); },
  project: (id) => scene?.projectNode(id),
  visitNts: () => enterNts(),
}, !webglAvailable);
overlay.element.append(ecosystemView.element);
const ntsView = new NtsView({
  select: id => nts.select(id), inspect: view => nts.inspect(view), introduce: () => nts.introduce(),
  closeIntroduction: () => nts.closeIntroduction(), closeReading: () => nts.closeReading(),
  return: () => nts.requestReturn(), dom: dom => nts.setDom(dom), locale: locale => localeController.setLocale(locale),
  project: () => scene?.projectNts(), memoryLift: active => scene?.setNtsMemoryLift(active),
}, !webglAvailable);
stage.append(ntsView.element);

if (webglAvailable) {
  scene = new StoryScene(stage, {
    world: STORY_WORLD_V0_1,
    reducedMotion: prefersReducedMotion(),
    onSelectNode: (nodeId) => {
      if (ecosystem.getState().open) selectEcosystem(nodeId);
      else controller.selectNode(nodeId);
    },
    onClearSelection: () => selectEcosystem(),
    onNtsPresence: () => nts.introduce(), onNtsMemory: id => nts.select(id),
    onNtsImageFailure: id => ntsView.imageFailed(id), onNtsPresenceFailure: () => { ntsView.presenceFailed(); if (!scene?.projectNts()) nts.setDom(true); },
    onRender: () => { overlay.refreshLabels(); ecosystemView.refreshLabels(); ntsView.refreshAnchors(); advanceNutuensaiJourney(); advanceNts(); },
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
  if (state.open && !ecosystemWasOpen) {
    returnFocus = requestedReturnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    requestedReturnFocus = null;
  }
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

const unsubscribeNutuensaiJourney = nutuensaiJourney.subscribe(state => {
  scene?.setNutuensaiJourneyActive(nutuensaiJourney.active);
  ecosystemView.setJourney(state);
});

function startNutuensaiStory(source: NutuensaiStorySource, trigger: HTMLButtonElement): void {
  const state = controller.getState();
  const allowed = source === "home" ? state.entryOpen : state.mode === "guided" && !state.entryOpen && STORY_WORLD_V0_1.beats[state.beatIndex].id === "human";
  if (destroyed || !allowed || state.aboutOpen || state.storyListOpen && webglAvailable || ecosystem.getState().open || !nutuensaiJourney.request(source)) return;
  requestedReturnFocus = trigger;
  lastNtsVisitRequest = undefined; feedback(true);
  ecosystem.enter(); nutuensaiJourney.travel();
  queueMicrotask(advanceNutuensaiJourney);
}

/** The same render owner advances authored travel only after its camera settles. */
function advanceNutuensaiJourney(): void {
  if (destroyed || !visible || !nutuensaiJourney.active || !ecosystem.getState().open) return;
  if (scene && !scene.ecosystemSettled) return;
  const state = nutuensaiJourney.getState();
  if (state.phase === "travelling" && state.leg === "ecosystem") {
    nutuensaiJourney.focus();
    if (ecosystem.getState().selectedNodeId !== "nutuensai") ecosystem.select("nutuensai");
    scene?.focusNutuensaiJourney();
    if (!scene || prefersReducedMotion()) queueMicrotask(advanceNutuensaiJourney);
  } else if (state.phase === "travelling" && state.leg === "nutuensai") {
    nutuensaiJourney.recognize();
    const delay = !scene || prefersReducedMotion() ? 0 : 420;
    recognitionReadyAt = performance.now() + delay;
    if (delay) recognitionTimer = setTimeout(() => { recognitionTimer = undefined; advanceNutuensaiJourney(); }, delay);
    else advanceNutuensaiJourney();
  } else if (state.phase === "recognition" && performance.now() >= recognitionReadyAt) {
    if (ecosystem.getState().selectedNodeId !== "nutuensai") { cancelNutuensaiJourney(false); return; }
    const request = nutuensaiJourney.consumeVisit();
    if (request) continueNtsVisit(request);
  }
}

/** Consume the authored intent before entering a bounded destination presentation. */
function continueNtsVisit(request: NtsVisitRequest): void {
  lastNtsVisitRequest = request;
  enterNts();
}

function enterNts(): void {
  if (destroyed || nts.active || !ecosystem.getState().open || ecosystem.getState().selectedNodeId !== "nutuensai") return;
  scene?.focusNutuensaiJourney(true);
  feedback(nts.enter(prefersReducedMotion() || !scene));
}

let ntsWasActive = false;
let ntsPreviousPhase = nts.getState().phase;
const unsubscribeNts = nts.subscribe(state => {
  const entering = nts.active && !ntsWasActive;
  const closing = state.phase === "closed" && ntsWasActive;
  const beginReturn = state.phase === "returning" && ntsPreviousPhase !== "returning";
  ntsWasActive = nts.active; ntsPreviousPhase = state.phase;
  if (entering) {
    overlay.element.inert = true; overlay.element.hidden = true;
    void scene?.enterNts();
  }
  if (closing) {
    scene?.finishNtsReturn(); overlay.element.inert = false; overlay.element.hidden = false;
    ecosystemView.render(ecosystem.getState()); ecosystemView.focusVisitNts();
  }
  if (nts.active) scene?.presentNts(state);
  if (beginReturn) scene?.returnFromNts();
  ntsView.render(state);
  scene?.setActive(visible && (nts.active || !(ecosystem.getState().open ? ecosystem.getState().listOpen : controller.getState().storyListOpen)));
  if (entering) ntsView.focusHeading();
  if (nts.active) queueMicrotask(advanceNts);
});

function advanceNts(): void {
  if (destroyed || !visible) return;
  const state = nts.getState();
  if (state.phase === "approaching" && (!scene || scene.ntsSettled)) nts.settle();
  else if (state.phase === "returning" && (!scene || scene.ntsReturnSettled)) nts.finishReturn();
}

function cancelNutuensaiJourney(settleInEcosystem: boolean): void {
  if (recognitionTimer) clearTimeout(recognitionTimer); recognitionTimer = undefined;
  if (!nutuensaiJourney.active) return;
  nutuensaiJourney.cancel();
  if (settleInEcosystem && ecosystem.getState().open) {
    if (ecosystem.getState().selectedNodeId !== "nutuensai") ecosystem.select("nutuensai");
    scene?.focusNutuensaiJourney(true); ecosystemView.focusNutuensaiArrival();
  }
}

opening = new FoundationalOpening(stage, overlay.element, prefersReducedMotion());
const stopReducedMotionObserver = observeReducedMotion((reduced) => {
  scene?.setReducedMotion(reduced); opening.setReducedMotion(reduced);
  if (nts.active) scene?.presentNts(nts.getState());
  if (reduced && nutuensaiJourney.getState().phase === "recognition") {
    if (recognitionTimer) clearTimeout(recognitionTimer); recognitionTimer = undefined; recognitionReadyAt = 0;
  }
  if (reduced) advanceNutuensaiJourney();
  if (reduced) advanceNts();
});
const stopVisibilityObserver = observeDocumentVisibility((nextVisible) => {
  visible = nextVisible;
  opening.setVisible(nextVisible);
  scene?.setActive(visible && (nts.active || !(ecosystem.getState().open ? ecosystem.getState().listOpen : controller.getState().storyListOpen)));
  interactionSound.setPageVisible(nextVisible);
  if (nextVisible) advanceNutuensaiJourney();
  if (nextVisible) advanceNts();
});
const unsubscribeLocale = localeController.subscribe((locale) => { overlay.setLocale(locale); ecosystemView.setLocale(locale); ntsView.setLocale(locale); opening.setLocale(locale); });

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== "Escape") return;
  if (nts.escape()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  const state = controller.getState();
  if (state.aboutOpen) controller.setAboutOpen(false);
  else if (nutuensaiJourney.active) {
    event.preventDefault(); event.stopPropagation(); cancelNutuensaiJourney(true);
  }
  else if (ecosystem.getState().open) {
    if (ecosystem.getState().listOpen) feedback(ecosystem.setListOpen(false));
    else if (ecosystem.getState().selectedNodeId) selectEcosystem();
    else feedback(ecosystem.exit());
  }
  else if (state.storyListOpen && webglAvailable) controller.setStoryListOpen(false);
};
window.addEventListener("keydown", onKeyDown);

function destroy(): void {
  if (destroyed) return; destroyed = true;
  if (recognitionTimer) clearTimeout(recognitionTimer); recognitionTimer = undefined;
  unsubscribeNutuensaiJourney(); nutuensaiJourney.dispose();
  unsubscribeNts(); nts.dispose(); ntsView.dispose();
  opening.dispose();
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
    inspect: () => ({ ...(scene?.getInspection() ?? { rendererType: "unavailable" as const, storyListFallback: true as const }), overviewState: ecosystem.getState(), storyState: controller.getState(), journeyState: nutuensaiJourney.getState(), ntsVisitRequest: lastNtsVisitRequest, ntsState: nts.getState() }),
    selectNode: (nodeId) => { if (ecosystem.getState().open) selectEcosystem(nodeId); else controller.selectNode(nodeId); },
    destroy,
  };
}

window.addEventListener("beforeunload", destroy, { once: true });
