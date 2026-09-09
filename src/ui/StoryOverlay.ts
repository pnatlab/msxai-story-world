import type { StoryState } from "../story/storyState";
import type { StoryWorldDefinition } from "../world/world.schema";
import { createAccessibleStoryView } from "./AccessibleStoryView";

export interface OverlayActions {
  readonly beginStory: () => void;
  readonly exploreFreely: () => void;
  readonly resumeStory: () => void;
  readonly next: () => void;
  readonly back: () => void;
  readonly resetView: () => void;
  readonly returnToHuman: () => void;
  readonly selectNode: (nodeId: string) => void;
  readonly setStoryListOpen: (open: boolean) => void;
  readonly setAboutOpen: (open: boolean) => void;
}

type NodeProjection = { x: number; y: number; depth: number; visible: boolean };

export class StoryOverlay {
  public readonly element = document.createElement("div");
  private readonly labels = new Map<string, HTMLButtonElement>();
  private readonly detail = document.createElement("aside");
  private readonly entry = document.createElement("section");
  private readonly about = document.createElement("section");
  private readonly storyList: ReturnType<typeof createAccessibleStoryView>;
  private currentState?: StoryState;
  private projectNode?: (nodeId: string) => NodeProjection;

  public constructor(private readonly world: StoryWorldDefinition, private readonly actions: OverlayActions, fallbackMessage?: string) {
    this.element.className = "story-overlay";
    this.element.innerHTML = `
      <header class="story-header">
        <a class="wordmark" href="./" aria-label="Restart MSxAI 3D Story World">MSxAI <span>Story World</span></a>
        <p class="free-mode-cue" data-copy="free-mode" hidden>Free Explore</p>
        <div class="story-header__actions">
          <button class="quiet-button" type="button" data-action="show-about">About / Meaning</button>
          <button class="quiet-button" type="button" data-action="story-list">Story List</button>
        </div>
      </header>
      <section class="story-copy" aria-live="polite">
        <p class="eyebrow" data-copy="mode"></p>
        <h1 data-copy="title"></h1>
        <p class="thai-copy" data-copy="thai-title"></p>
        <div data-copy="lines"></div>
        <p class="thai-copy" data-copy="thai-line"></p>
      </section>
      <nav class="story-controls" aria-label="Story controls">
        <button class="quiet-button" type="button" data-action="back">Back</button>
        <button class="primary-button" type="button" data-action="next">Next</button>
        <button class="quiet-button" type="button" data-action="explore">Explore Freely</button>
        <button class="quiet-button" type="button" data-action="reset">Reset View</button>
        <button class="quiet-button" type="button" data-action="human">Return to Human</button>
      </nav>
      <p class="truth-cue">Conceptual relationships — not model cognition.</p>
      <div class="node-labels" aria-label="Concept anchors"></div>
    `;

    this.entry.className = "entry-card";
    this.entry.dataset.testid = "entry-card";
    this.entry.innerHTML = `
      <p class="eyebrow">MSxAI 3D Story World</p>
      <h1>AI is becoming more capable.<br />But who holds the intention?</h1>
      <p class="thai-copy">AI มีความสามารถมากขึ้น แล้วใครคือผู้ถือเจตนา?</p>
      <p class="entry-card__boundary">${world.truthfulnessNotice}</p>
      <div class="entry-card__actions">
        <button class="primary-button" type="button" data-action="begin">Begin the Story</button>
        <button class="quiet-button" type="button" data-action="free">Explore Freely</button>
      </div>
      ${fallbackMessage ? `<p class="fallback-message" role="status">${fallbackMessage}</p>` : ""}
    `;
    this.element.append(this.entry);

    this.detail.className = "concept-detail";
    this.detail.setAttribute("aria-live", "polite");
    this.element.append(this.detail);

    this.about.className = "about-dialog";
    this.about.setAttribute("role", "dialog");
    this.about.setAttribute("aria-modal", "true");
    this.about.setAttribute("aria-label", "About this conceptual world");
    this.about.hidden = true;
    this.about.innerHTML = `
      <div class="about-dialog__panel">
        <button class="icon-button" type="button" data-action="close-about" aria-label="Close About">×</button>
        <p class="eyebrow">Meaning</p>
        <h2>An explorable conceptual world</h2>
        <p>${world.truthfulnessNotice}</p>
        <p>The ocean, anchors, ambient points, and connections are conceptual editorial structure. Ambient points carry no concepts. Exploration does not perform work, send a request, or change MSS.</p>
      </div>
    `;
    this.element.append(this.about);

    this.storyList = createAccessibleStoryView(world, {
      selectNode: actions.selectNode,
      back: actions.back,
      next: actions.next,
      returnToHuman: actions.returnToHuman,
      close: () => actions.setStoryListOpen(false),
    });
    this.storyList.element.hidden = true;
    this.element.append(this.storyList.element);

    const labels = this.element.querySelector<HTMLElement>(".node-labels");
    if (!labels) throw new Error("Node label region is missing.");
    world.nodes.forEach((node) => {
      const button = document.createElement("button");
      button.className = "node-label";
      button.type = "button";
      button.dataset.nodeId = node.id;
      button.innerHTML = `<strong>${node.label}</strong>`;
      button.addEventListener("click", () => actions.selectNode(node.id));
      labels.append(button);
      this.labels.set(node.id, button);
    });

    this.bindActions();
  }

  public setProjector(projectNode: (nodeId: string) => NodeProjection): void {
    this.projectNode = projectNode;
  }

  public render(state: StoryState): void {
    this.currentState = state;
    const beat = this.world.beats[state.beatIndex];
    this.element.querySelector<HTMLElement>('[data-copy="mode"]')!.textContent = state.mode === "guided" ? `Guided Story · ${beat.order + 1} / ${this.world.beats.length}` : "Free Explore";
    this.element.querySelector<HTMLElement>('[data-copy="title"]')!.textContent = beat.title;
    this.element.querySelector<HTMLElement>('[data-copy="thai-title"]')!.textContent = beat.thaiTitle;
    this.element.querySelector<HTMLElement>('[data-copy="lines"]')!.innerHTML = beat.lines.map((line) => `<p>${line}</p>`).join("");
    this.element.querySelector<HTMLElement>('[data-copy="thai-line"]')!.textContent = beat.thaiLine ?? "";
    this.entry.hidden = !state.entryOpen;
    this.element.querySelector<HTMLElement>(".story-copy")!.hidden = state.entryOpen || state.mode === "free";
    this.element.querySelector<HTMLElement>('[data-copy="free-mode"]')!.hidden = state.mode !== "free" || state.entryOpen;
    this.element.querySelector<HTMLElement>(".story-controls")!.hidden = state.entryOpen;
    this.about.hidden = !state.aboutOpen;
    this.storyList.element.hidden = !state.storyListOpen;
    this.storyList.render(state);

    const next = this.element.querySelector<HTMLButtonElement>('[data-action="next"]')!;
    const back = this.element.querySelector<HTMLButtonElement>('[data-action="back"]')!;
    next.textContent = state.mode === "free" ? "Resume Story" : beat.nextLabel ?? "Story Complete";
    next.disabled = state.mode === "guided" && state.beatIndex === this.world.beats.length - 1;
    back.disabled = state.mode === "free" || state.beatIndex === 0;
    const explore = this.element.querySelector<HTMLButtonElement>('[data-action="explore"]')!;
    explore.textContent = "Explore Freely";
    explore.hidden = state.mode === "free";
    this.renderDetail(state.selectedNodeId);
    this.refreshLabels();
  }

  public refreshLabels(): void {
    if (!this.currentState || !this.projectNode) {
      this.labels.forEach((label) => { label.hidden = true; });
      return;
    }
    const beat = this.world.beats[this.currentState.beatIndex];
    const visibleNodes = this.currentState.mode === "free" ? this.world.nodes.map((node) => node.id) : beat.revealNodeIds;
    this.labels.forEach((label, id) => {
      const projection = this.projectNode?.(id);
      const node = this.world.nodes.find((entry) => entry.id === id);
      const isPrimaryNode = node?.kind !== "principle";
      const shouldName = this.currentState?.mode === "free"
        ? isPrimaryNode || id === this.currentState.selectedNodeId
        : id === beat.focusNodeId || (beat.id === "opening" && id === "human") || id === this.currentState?.selectedNodeId;
      const visible = visibleNodes.includes(id) && shouldName && Boolean(projection?.visible) && !this.currentState?.storyListOpen;
      label.hidden = !visible;
      label.classList.toggle("is-selected", id === this.currentState?.selectedNodeId);
      if (projection) {
        label.style.transform = `translate(${projection.x}px, ${projection.y}px)`;
        label.style.opacity = String(Math.max(0.48, Math.min(1, 1.18 - projection.depth * 0.35)));
      }
    });
  }

  private renderDetail(selectedNodeId?: string): void {
    const node = this.world.nodes.find((entry) => entry.id === selectedNodeId);
    const beat = this.currentState ? this.world.beats[this.currentState.beatIndex] : undefined;
    const isAutomaticGuidedFocus = this.currentState?.mode === "guided" && beat?.focusNodeId === selectedNodeId;
    if (!node || this.currentState?.entryOpen || this.currentState?.storyListOpen || isAutomaticGuidedFocus) {
      this.detail.hidden = true;
      return;
    }
    this.detail.hidden = false;
    this.detail.innerHTML = `
      <p class="eyebrow">Concept anchor</p>
      <h2>${node.label}</h2>
      <p class="thai-copy">${node.thaiLabel}</p>
      <p>${node.summary}</p>
      <ul>${node.detail.map((line) => `<li>${line}</li>`).join("")}</ul>
    `;
  }

  private bindActions(): void {
    const listen = (action: string, callback: () => void) => {
      this.element.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener("click", callback);
    };
    listen("begin", this.actions.beginStory);
    listen("free", this.actions.exploreFreely);
    listen("next", () => this.currentState?.mode === "free" ? this.actions.resumeStory() : this.actions.next());
    listen("back", this.actions.back);
    listen("explore", () => this.currentState?.mode === "free" ? this.actions.resumeStory() : this.actions.exploreFreely());
    listen("reset", this.actions.resetView);
    listen("human", this.actions.returnToHuman);
    listen("story-list", () => this.actions.setStoryListOpen(true));
    listen("show-about", () => this.actions.setAboutOpen(true));
    listen("close-about", () => this.actions.setAboutOpen(false));
  }
}
